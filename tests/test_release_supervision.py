"""Ownership, teardown, and portable fixture regressions without external services."""

import fcntl
import errno
import functools
import os
from pathlib import Path
import select
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

from tests.release_test_support import SupervisedProcess, SupervisionError, temporary_directory
from tests import test_bash_release as baseline
from tests import test_consumer_release as consumer
from tests import release_test_support as support


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


class LaunchOwnershipTests(unittest.TestCase):
  def setUp(self):
    self.temporary = temporary_directory(prefix="launch-ownership-")
    self.addCleanup(self.temporary.cleanup)
    self.base = Path(self.temporary.name)

  def test_lost_started_acknowledgement_reaps_child_before_failure_delivery(self):
    marker = self.base / "child"
    code = ("import os,signal; from pathlib import Path; "
            f"Path({str(marker)!r}).write_text(str(os.getpid())); signal.pause()")
    actual_type = support.SupervisedProcess
    original_receive = actual_type.receive
    instances = []

    def create(*args, **kwargs):
      process = actual_type(*args, **kwargs, grace=.1)
      instances.append(process)
      return process

    def lose_ack(process, deadline):
      message = original_receive(process, deadline)
      if message["event"] == "started":
        ready_deadline = time.monotonic() + 3
        while not marker.exists() and time.monotonic() < ready_deadline:
          time.sleep(.005)
        self.assertTrue(marker.exists(), "A live child must precede acknowledgement failure")
        raise LookupError("injected launch acknowledgement loss")
      return message

    try:
      with patch.object(support, "SupervisedProcess", side_effect=create), \
           patch.object(actual_type, "receive", lose_ack):
        with self.assertRaisesRegex(LookupError, "acknowledgement loss"):
          support.run_supervised([sys.executable, "-c", code], cwd=self.base, env=os.environ.copy())
      self.assertFalse(Path("/proc/" + marker.read_text()).exists(), "Failure delivery must follow reaping")
      self.assertIsNotNone(instances[0].process.poll())
    finally:
      for process in instances:
        process.close()

  def test_initial_root_pidfd_failure_does_not_escape_owned_cleanup(self):
    supervisor = Path(__file__).with_name("release_supervisor.py")
    code = f'''import errno, importlib.util, json, os, signal, socket, subprocess, sys
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("isolated_supervisor", {str(supervisor)!r})
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
signal.signal(signal.SIGCHLD, signal.SIG_IGN)
module.enable_subreaper()
assert signal.getsignal(signal.SIGCHLD) == signal.SIG_DFL
observer, channel = socket.socketpair()
observer.sendall(b"start\\n")
actual_spawn, actual_pidfd = subprocess.Popen, os.pidfd_open
spawned, handles = [], []
def spawn(*args, **kwargs):
  process = actual_spawn(*args, **kwargs)
  spawned.append(process)
  handles.append(actual_pidfd(process.pid))
  return process
try:
  with patch.object(module.subprocess, "Popen", side_effect=spawn), \\
       patch.object(module.os, "pidfd_open", side_effect=OSError(errno.EMFILE, "injected root handle failure")):
    try:
      module.supervise(channel, .1, [sys.executable, "-c", "import signal; signal.pause()"])
    except OSError:
      pass
  assert spawned, "Root must have launched before the acquisition fault"
  assert spawned[0].poll() is not None, "Root acquisition failure escaped with a live child"
finally:
  for descriptor in handles:
    try:
      signal.pidfd_send_signal(descriptor, signal.SIGKILL)
    except ProcessLookupError:
      pass
    os.close(descriptor)
  for process in spawned:
    process.wait(timeout=5)
  observer.close()
  channel.close()
'''
    result = subprocess.run([sys.executable, "-B", "-c", code], capture_output=True, text=True, timeout=10)
    self.assertEqual(result.returncode, 0, result.stderr)

  def test_unconsumed_ack_and_context_entry_failure_reap_separate_session_descendant(self):
    root_pid, child_pid, ready = (self.base / name for name in ("root", "descendant", "ready"))
    lock = self.base / "lock"
    child = ("import fcntl,os,signal,sys; from pathlib import Path; "
             f"f=open({str(lock)!r},'w'); fcntl.flock(f,fcntl.LOCK_EX); "
             "signal.signal(signal.SIGTERM,signal.SIG_IGN); "
             f"Path({str(child_pid)!r}).write_text(str(os.getpid())); "
             "os.write(int(sys.argv[1]),b'1'); signal.pause()")
    code = ("import os,signal,subprocess,sys; from pathlib import Path; r,w=os.pipe(); "
            f"subprocess.Popen([sys.executable,'-c',{child!r},str(w)],pass_fds=(w,),start_new_session=True); "
            "os.close(w); assert os.read(r,1)==b'1'; "
            f"Path({str(root_pid)!r}).write_text(str(os.getpid())); Path({str(ready)!r}).touch(); signal.pause()")
    process = SupervisedProcess([sys.executable, "-c", code], cwd=self.base, env=os.environ.copy(), grace=.1)
    self.addCleanup(process.close)
    unrelated = subprocess.Popen([sys.executable, "-c", "import signal; signal.pause()"])
    original_receive = process.receive

    def lose_before_read(deadline):
      if process.start_requested:
        end = time.monotonic() + 3
        while not ready.exists() and time.monotonic() < end:
          time.sleep(.005)
        self.assertTrue(ready.exists())
        raise TimeoutError("injected unread launch acknowledgement")
      return original_receive(deadline)

    try:
      with patch.object(process, "receive", side_effect=lose_before_read):
        with self.assertRaisesRegex(TimeoutError, "unread launch"):
          with process:
            self.fail("Context body must not execute after failed entry")
      for marker in (root_pid, child_pid):
        self.assertFalse(Path("/proc/" + marker.read_text()).exists(), "Both sessions must be reaped before failure")
      self.assertTrue(process.teardown_confirmed)
      self.assertTrue(process.status["forced"])
      with lock.open() as held:
        fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
      self.assertIsNone(unrelated.poll())
      process.close()
    finally:
      unrelated.terminate()
      unrelated.wait(timeout=5)

  def test_send_failure_before_dispatch_does_not_launch_and_preserves_exception(self):
    marker = self.base / "never-started"
    process = SupervisedProcess([sys.executable, "-c", f"from pathlib import Path; Path({str(marker)!r}).touch()"],
                                cwd=self.base, env=os.environ.copy(), grace=.1)
    self.addCleanup(process.close)
    original_send = process.send
    failure = BrokenPipeError("injected START send failure")
    def fail_start(message):
      if message == "start":
        raise failure
      return original_send(message)
    with patch.object(process, "send", side_effect=fail_start):
      with self.assertRaises(BrokenPipeError) as raised:
        process.start()
    self.assertIs(raised.exception, failure)
    self.assertTrue(process.teardown_confirmed)
    self.assertFalse(marker.exists())
    self.assertIsNotNone(process.process.poll())
    process.close()

  def test_partial_constructor_closes_sockets_when_supervisor_spawn_fails(self):
    original_pair = support.socket.socketpair
    sockets = []
    def pair():
      result = original_pair()
      sockets.extend(result)
      return result
    with patch.object(support.socket, "socketpair", side_effect=pair), \
         patch.object(support.subprocess, "Popen", side_effect=OSError(errno.EMFILE, "injected supervisor spawn failure")):
      with self.assertRaises(OSError):
        SupervisedProcess([sys.executable, "-c", "pass"], cwd=self.base, env=os.environ.copy())
    self.assertEqual([descriptor.fileno() for descriptor in sockets], [-1, -1])
    with patch.object(support.socket, "socketpair", side_effect=OSError(errno.EMFILE, "injected socket failure")), \
         patch.object(support.subprocess, "Popen") as spawn:
      with self.assertRaises(OSError):
        SupervisedProcess([sys.executable, "-c", "pass"], cwd=self.base, env=os.environ.copy())
      spawn.assert_not_called()

  def test_readiness_failure_reaps_supervisor_without_launching_release(self):
    actual_spawn = support.subprocess.Popen
    processes = []
    marker = self.base / "never-launched"
    def spawn(*args, **kwargs):
      result = actual_spawn(*args, **kwargs)
      processes.append(result)
      return result
    with patch.object(support.subprocess, "Popen", side_effect=spawn), \
         patch.object(SupervisedProcess, "receive", side_effect=ValueError("injected readiness failure")):
      with self.assertRaisesRegex(ValueError, "readiness failure"):
        SupervisedProcess([sys.executable, "-c", f"from pathlib import Path; Path({str(marker)!r}).touch()"],
                          cwd=self.base, env=os.environ.copy())
    self.assertEqual(len(processes), 1)
    self.assertIsNotNone(processes[0].poll())
    self.assertTrue(processes[0].stdout.closed and processes[0].stderr.closed)
    self.assertFalse(marker.exists())

  def test_incomplete_launch_teardown_preserves_cause_and_retains_fixture(self):
    process = object.__new__(SupervisedProcess)
    cause = LookupError("injected original launch failure")
    with patch.object(process, "close", side_effect=SupervisionError("injected incomplete teardown")):
      with self.assertRaises(SupervisionError) as raised:
        process._close_after_failure(cause)
    self.assertIs(raised.exception.__cause__, cause)
    case = baseline.BashPublicationTests()
    case.setUp()
    try:
      with patch.object(baseline, "run_supervised", side_effect=raised.exception):
        with self.assertRaises(SupervisionError):
          case.release()
      self.assertTrue(case.retain_fixture)
      case.doCleanups()
      self.assertTrue(case.base.is_dir(), "Incomplete proof must suppress fixture finalization")
    finally:
      # This simulated incomplete result never launched real release processes.
      case.temporary.cleanup()

    case = baseline.BashPublicationTests()
    case.setUp()
    try:
      with patch.object(baseline, "SupervisedProcess", side_effect=raised.exception):
        with self.assertRaises(SupervisionError):
          case.start_release()
      case.doCleanups()
      self.assertTrue(case.base.is_dir(), "Special launcher must retain an unproved constructor fixture")
    finally:
      case.temporary.cleanup()

  def test_root_handle_failure_reaps_synchronized_descendant_and_reports_failure(self):
    supervisor = Path(__file__).with_name("release_supervisor.py")
    root_pid, child_pid, ready = (self.base / name for name in ("fault-root", "fault-child", "fault-ready"))
    child = ("import os,signal,sys; from pathlib import Path; signal.signal(signal.SIGTERM,signal.SIG_IGN); "
             f"Path({str(child_pid)!r}).write_text(str(os.getpid())); os.write(int(sys.argv[1]),b'1'); signal.pause()")
    root_code = ("import os,signal,subprocess,sys; from pathlib import Path; r,w=os.pipe(); "
                 f"subprocess.Popen([sys.executable,'-c',{child!r},str(w)],pass_fds=(w,),start_new_session=True); "
                 "os.close(w); assert os.read(r,1)==b'1'; "
                 f"Path({str(root_pid)!r}).write_text(str(os.getpid())); Path({str(ready)!r}).touch(); signal.pause()")
    code = f'''import errno, importlib.util, json, os, signal, socket, subprocess, sys, time
from pathlib import Path
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("isolated_supervisor", {str(supervisor)!r})
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.enable_subreaper()
observer, channel = socket.socketpair()
observer.sendall(b"start\\n")
actual_spawn, actual_pidfd = subprocess.Popen, os.pidfd_open
spawned, emergency_handles = [], []
injected = False
def spawn(*args, **kwargs):
  process = actual_spawn(*args, **kwargs)
  spawned.append(process)
  end = time.monotonic() + 3
  while not Path({str(ready)!r}).exists() and time.monotonic() < end:
    time.sleep(.005)
  assert Path({str(ready)!r}).exists(), "Both sessions must be ready before the acquisition fault"
  for marker in ({str(root_pid)!r}, {str(child_pid)!r}):
    emergency_handles.append(actual_pidfd(int(Path(marker).read_text())))
  return process
def fail_root_once(pid):
  global injected
  if not injected and spawned and pid == spawned[0].pid:
    injected = True
    raise OSError(errno.EMFILE, "injected initial root acquisition")
  return actual_pidfd(pid)
try:
  with patch.object(module.subprocess, "Popen", side_effect=spawn), \\
       patch.object(module.os, "pidfd_open", side_effect=fail_root_once):
    assert module.supervise(channel, .1, [sys.executable, "-c", {root_code!r}]) is True
  observer.settimeout(2)
  messages = b""
  while b'"event": "failed"' not in messages:
    messages += observer.recv(65536)
  status = json.loads(messages.splitlines()[-1])
  assert status["event"] == "failed" and status["reaped"] is True
  assert "errno=24" in status["reason"]
  for marker in ({str(root_pid)!r}, {str(child_pid)!r}):
    assert not Path("/proc/" + Path(marker).read_text()).exists(), "Failure reported before reaping"
finally:
  for descriptor in emergency_handles:
    try:
      signal.pidfd_send_signal(descriptor, signal.SIGKILL)
    except ProcessLookupError:
      pass
    os.close(descriptor)
  for process in spawned:
    if process.returncode is None:
      process.wait(timeout=5)
  observer.close()
  channel.close()
'''
    result = subprocess.run([sys.executable, "-B", "-c", code], capture_output=True, text=True, timeout=10)
    self.assertEqual(result.returncode, 0, result.stderr)

  def test_root_spawn_failure_is_reported_after_no_child_teardown(self):
    process = SupervisedProcess([str(self.base / "missing-executable")], cwd=self.base,
                                env=os.environ.copy(), grace=.1)
    self.addCleanup(process.close)
    with self.assertRaisesRegex(SupervisionError, "did not start"):
      process.start()
    self.assertTrue(process.teardown_confirmed)
    self.assertEqual(process.status["event"], "failed")
    self.assertTrue(process.status["reaped"])
    self.assertIsNotNone(process.process.poll())

  def test_malformed_acknowledgement_and_start_interruption_share_guarded_cleanup(self):
    for fault in ("malformed", "interrupt"):
      with self.subTest(fault=fault):
        marker = self.base / ("started-" + fault)
        code = ("import os,signal; from pathlib import Path; "
                f"Path({str(marker)!r}).write_text(str(os.getpid())); signal.pause()")
        process = SupervisedProcess([sys.executable, "-c", code], cwd=self.base, env=os.environ.copy(), grace=.1)
        self.addCleanup(process.close)
        original = process.receive
        failure = KeyboardInterrupt("injected start interruption")
        def faulty_receive(deadline):
          message = original(deadline)
          if message["event"] == "started":
            end = time.monotonic() + 3
            while not marker.exists() and time.monotonic() < end:
              time.sleep(.005)
            self.assertTrue(marker.exists())
            if fault == "interrupt":
              raise failure
            return {"event": "unexpected"}
          return message
        with patch.object(process, "receive", side_effect=faulty_receive):
          with self.assertRaises(KeyboardInterrupt if fault == "interrupt" else SupervisionError) as raised:
            process.start()
        if fault == "interrupt":
          self.assertIs(raised.exception, failure)
        self.assertTrue(process.teardown_confirmed)
        self.assertFalse(Path("/proc/" + marker.read_text()).exists())
        process.close()
