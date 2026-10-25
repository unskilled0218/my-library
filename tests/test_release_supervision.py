"""Ownership, teardown, and portable fixture regressions without external services."""

import fcntl
import functools
import os
from pathlib import Path
import select
import subprocess
import sys
import unittest
from unittest.mock import patch

from tests.release_test_support import SupervisedProcess, SupervisionError, temporary_directory
from tests import test_bash_release as baseline
from tests import test_consumer_release as consumer


class TemporaryParentTests(unittest.TestCase):
  def test_present_and_absent_preferred_parent_create_real_fixtures(self):
    with temporary_directory() as base:
      preferred = Path(base) / "preferred"
      preferred.mkdir()
      for path in (preferred, Path(base) / "absent"):
        with self.subTest(preferred=path.name):
          factory = functools.partial(temporary_directory, preferred=path)
          with factory() as directory:
            target = Path(directory)
            self.assertTrue(target.is_dir())
            if path.exists():
              self.assertEqual(target.parent, path)
          with patch.object(consumer, "temporary_directory", factory):
            consumer.ConsumerReleaseTests().test_validation_with_missing_token_cannot_invoke_services_or_create_state()
          with patch.object(baseline, "temporary_directory", factory):
            case = baseline.BashDataTests()
            case.setUp()
            case.test_same_origin_bearer_challenge_retries_with_private_token()
          self.assertFalse((Path(base) / "absent").exists())


class SupervisorTests(unittest.TestCase):
  def setUp(self):
    self.temporary = temporary_directory(prefix="supervisor-test-")
    self.addCleanup(self.temporary.cleanup)
    self.base = Path(self.temporary.name)

  def start(self, code, **options):
    process = SupervisedProcess([sys.executable, "-c", code], cwd=self.base,
                                env=os.environ.copy(), grace=.15, **options)
    self.addCleanup(process.close)
    return process.start()

  def ready(self, process):
    self.assertTrue(select.select([process.stdout], [], [], 5)[0], "Child did not signal readiness")
    self.assertEqual(os.read(process.stdout.fileno(), 6), b"ready\n")

  def test_success_and_nonzero_exit_preserve_output(self):
    for status in (0, 7):
      with self.subTest(status=status):
        process = self.start(f"import sys; print('out'); print('err', file=sys.stderr); sys.exit({status})")
        self.assertEqual(process.communicate(timeout=5), (b"out\n", b"err\n"))
        self.assertEqual(process.returncode, status)
        self.assertTrue(process.status["reaped"])
        self.assertFalse(process.status["forced"])

  def test_unavailable_capability_does_not_launch_release(self):
    marker = self.base / "must-not-launch"
    with self.assertRaises(unittest.SkipTest):
      self.start(f"from pathlib import Path; Path({str(marker)!r}).touch()", fail_setup=True)
    self.assertFalse(marker.exists())

  def test_invalid_or_exited_discovery_candidates_never_use_raw_pid_signaling(self):
    # Import the supervisor only in an isolated process; the unittest runner is never a subreaper.
    script = Path(__file__).with_name("release_supervisor.py")
    code = f'''import errno, importlib.util
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("supervisor", {str(script)!r})
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
for number in (errno.EINVAL, errno.ESRCH):
  with patch.object(module.os, "pidfd_open", side_effect=OSError(number, "injected")), \\
       patch.object(module.signal, "pidfd_send_signal") as signal:
    assert module.acquire_pidfd(123) is None
    signal.assert_not_called()
with patch.object(module.os, "pidfd_open", side_effect=PermissionError(errno.EPERM, "injected")):
  try:
    module.acquire_pidfd(123)
  except PermissionError:
    pass
  else:
    raise AssertionError("Non-transient acquisition failures must remain fatal")
'''
    result = subprocess.run([sys.executable, "-B", "-c", code], capture_output=True, text=True, timeout=10)
    self.assertEqual(result.returncode, 0, result.stderr)

  def test_cooperative_timeout_is_not_reported_as_a_normal_result(self):
    code = "import signal,sys; signal.signal(signal.SIGTERM, lambda *_: sys.exit(143)); print('ready', flush=True); signal.pause()"
    process = self.start(code)
    self.ready(process)
    with self.assertRaises(subprocess.TimeoutExpired):
      process.communicate(timeout=.05)
    self.assertEqual(process.returncode, 143)
    self.assertTrue(process.status["reaped"])
    self.assertFalse(process.status["forced"])

  def test_orphan_in_another_session_is_adopted_killed_and_reaped(self):
    pidfile = self.base / "descendant"
    lock = self.base / "lock"
    directory = self.base / "bash-release.owned"
    preexisting = self.base / "bash-release.preexisting"
    preexisting.mkdir()
    # The descendant signals readiness only after holding the lock and ignoring TERM.
    child = ("import fcntl,os,signal,sys; from pathlib import Path; "
             f"Path({str(directory)!r}).mkdir(); f=open({str(lock)!r},'w'); "
             "fcntl.flock(f,fcntl.LOCK_EX); signal.signal(signal.SIGTERM,signal.SIG_IGN); "
             f"Path({str(pidfile)!r}).write_text(str(os.getpid())); print('ready',flush=True); "
             "os.write(int(sys.argv[1]),b'1'); signal.pause()")
    code = ("import os,subprocess,sys; r,w=os.pipe(); "
            f"subprocess.Popen([sys.executable,'-c',{child!r},str(w)],pass_fds=(w,),start_new_session=True); "
            "os.close(w); assert os.read(r,1)==b'1'")
    unrelated = subprocess.Popen([sys.executable, "-c", "import signal; signal.pause()"])
    try:
      process = self.start(code)
      self.ready(process)
      descendant = int(pidfile.read_text())
      process.communicate(timeout=5)
      self.assertTrue(process.status["forced"])
      self.assertTrue(process.status["reaped"])
      self.assertFalse(Path(f"/proc/{descendant}").exists(), "Descendant must be reaped, not merely killed")
      self.assertFalse(directory.exists(), "Forced cleanup follows successful reaping")
      self.assertTrue(preexisting.is_dir(), "Existing paths are not owned by this invocation")
      with lock.open() as held:
        fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
      self.assertIsNone(unrelated.poll(), "A separate process is outside the supervisor's ownership")
    finally:
      unrelated.terminate()
      unrelated.wait(timeout=5)

  def test_control_channel_eof_requests_bounded_teardown(self):
    process = self.start("import signal; print('ready',flush=True); signal.pause()")
    self.ready(process)
    process.control.shutdown(1)
    process.communicate(timeout=5)
    self.assertNotEqual(process.returncode, 0)
    self.assertTrue(process.status["reaped"])

  def test_explicit_cancellation_and_output_overflow_are_bounded(self):
    process = self.start("import signal; print('ready',flush=True); signal.pause()")
    self.ready(process)
    process.terminate()
    process.communicate(timeout=5)
    self.assertTrue(process.status["reaped"])
    overflow = self.start("import os\nwhile True: os.write(1,b'x'*65536)")
    with self.assertRaisesRegex(SupervisionError, "2 MiB"):
      overflow.communicate(timeout=5)
    self.assertTrue(overflow.status["reaped"])
