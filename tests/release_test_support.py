"""Portable fixtures and invocation-local process supervision for release tests."""

import json
import os
from pathlib import Path
import selectors
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest


def temporary_directory(*, prefix="release-test-", preferred="/tmp/opencode"):
  """Prefer the harness directory without requiring it on other test runners."""
  parent = Path(preferred)
  if parent.is_dir() and os.access(parent, os.W_OK | os.X_OK):
    try:
      return tempfile.TemporaryDirectory(prefix=prefix, dir=parent)
    except (FileNotFoundError, PermissionError):
      pass
  return tempfile.TemporaryDirectory(prefix=prefix)


class SupervisionError(RuntimeError):
  pass


class SupervisedProcess:
  """A release child whose descendants belong to a separate Linux subreaper."""

  def __init__(self, arguments, *, cwd, env, grace=5, fail_setup=False):
    self.arguments, self.cwd = arguments, Path(cwd)
    self.grace = grace
    self.started = False
    self.start_requested = False
    self.closed = False
    self.teardown_confirmed = False
    self.status = None
    self.returncode = None
    self.buffer = bytearray()
    self.output = {"stdout": bytearray(), "stderr": bytearray()}
    self.control = self.process = self.stdout = self.stderr = child_control = None
    try:
      self.control, child_control = socket.socketpair()
      self.control.setblocking(False)
      script = Path(__file__).with_name("release_supervisor.py")
      self.process = subprocess.Popen(
        [sys.executable, "-B", str(script), str(child_control.fileno()), str(grace),
         "fail" if fail_setup else "ready", *map(str, arguments)],
        cwd=cwd, env=env, pass_fds=(child_control.fileno(),),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
      child_control.close()
      child_control = None
      self.stdout, self.stderr = self.process.stdout, self.process.stderr
      message = self.receive(time.monotonic() + 5)
      if message["event"] == "unsupported":
        raise unittest.SkipTest(message["reason"])
      if message["event"] != "ready":
        raise SupervisionError("Supervisor setup failed before release launch")
    except BaseException as error:
      if child_control is not None:
        child_control.close()
      self._close_after_failure(error)
      raise

  def receive(self, deadline):
    return self._receive(deadline)

  def _receive(self, deadline):
    with selectors.DefaultSelector() as selector:
      selector.register(self.control, selectors.EVENT_READ)
      while b"\n" not in self.buffer:
        remaining = deadline - time.monotonic()
        if remaining <= 0 or not selector.select(remaining):
          raise SupervisionError("Supervisor control deadline exceeded; retain fixture")
        chunk = self.control.recv(65536)
        if not chunk:
          raise SupervisionError("Supervisor ended without teardown acknowledgement; retain fixture")
        self.buffer.extend(chunk)
        if len(self.buffer) > 65536:
          raise SupervisionError("Supervisor control output exceeded its bound")
    line, _, rest = self.buffer.partition(b"\n")
    self.buffer = bytearray(rest)
    return json.loads(line)

  def send(self, message):
    self.control.sendall((message + "\n").encode())

  def start(self):
    if self.start_requested or self.closed:
      raise SupervisionError("Release start cannot be replayed")
    try:
      # Dispatch may succeed even when sending or observing the acknowledgement fails.
      self.start_requested = True
      self.send("start")
      message = self.receive(time.monotonic() + 5)
      if message["event"] != "started":
        if message["event"] in ("failed", "incomplete", "complete"):
          self.status = message
        raise SupervisionError("Release did not start: " + message.get("reason", "unexpected acknowledgement"))
      self.pid = message["pid"]
      self.started = True
      return self
    except BaseException as error:
      self._close_after_failure(error)
      raise

  def _close_after_failure(self, error):
    try:
      self.close()
    except BaseException as cleanup_error:
      raise SupervisionError("Launch cleanup could not be proved; retain fixture: " +
                             type(cleanup_error).__name__) from error

  def __enter__(self):
    return self.start()

  def __exit__(self, *_):
    self.close()

  def poll(self):
    return self.returncode if self.returncode is not None else self.process.poll()

  def terminate(self):
    if self.status is None:
      self.send("cancel")

  def kill(self):
    self.terminate()

  def communicate(self, timeout=90, *, _closing=False):
    if self.status is not None and self.status["event"] == "complete":
      return tuple(bytes(self.output[name]) for name in ("stdout", "stderr"))
    deadline = time.monotonic() + timeout
    expired = False
    failure = None
    with selectors.DefaultSelector() as selector:
      for name, stream in (("stdout", self.stdout), ("stderr", self.stderr)):
        if not stream.closed:
          os.set_blocking(stream.fileno(), False)
          selector.register(stream, selectors.EVENT_READ, name)
      while selector.get_map():
        if time.monotonic() >= deadline:
          if expired:
            raise SupervisionError("Output pipes survived bounded teardown; retain fixture")
          expired = True
          self.terminate()
          deadline = time.monotonic() + self.grace + 10
        for key, _ in selector.select(min(.05, max(0, deadline - time.monotonic()))):
          chunk = os.read(key.fd, 65536)
          if not chunk:
            selector.unregister(key.fileobj)
            continue
          target = self.output[key.data]
          if len(target) + len(chunk) > 2097152:
            failure = SupervisionError("Release test output exceeds 2 MiB per stream")
            if not expired:
              self.terminate()
              expired = True
              deadline = time.monotonic() + self.grace + 10
          else:
            target.extend(chunk)
    if self.status is None:
      control_deadline = time.monotonic() + self.grace + 10
      while True:
        message = self._receive(control_deadline)
        if message.get("event") == "started":
          # Acknowledgement can still be queued when a failed start requests cancellation.
          continue
        self.status = message
        break
    self._accept_status(raise_failure=not _closing)
    stdout, stderr = (bytes(self.output[name]) for name in ("stdout", "stderr"))
    if failure:
      raise failure
    if expired:
      raise subprocess.TimeoutExpired(self.arguments, timeout, output=stdout, stderr=stderr)
    return stdout, stderr

  def _accept_status(self, *, raise_failure=True):
    self.process.wait(timeout=5)
    if self.status.get("event") not in ("complete", "failed") or self.status.get("reaped") is not True:
      (self.cwd / f"supervision-failure-{self.process.pid}.json").write_text(json.dumps(self.status))
      raise SupervisionError("Owned process teardown incomplete; retain fixture: " + self.status.get("reason", "deadline"))
    self.teardown_confirmed = True
    self.returncode = self.status["returncode"]
    if self.status["forced"]:
      for value in self.status["directories"]:
        path = Path(value)
        if path.parent != self.cwd or path.is_symlink() or not path.name.startswith("bash-release."):
          raise SupervisionError("Unsafe forced-cleanup path")
        if path.exists():
          shutil.rmtree(path)
    if raise_failure and self.status["event"] == "failed":
      raise SupervisionError("Supervised operation failed after owned teardown: " + self.status.get("reason", "failure"))

  def close(self):
    if self.closed:
      return
    try:
      if self.process is None:
        return
      if self.status is not None:
        if not self.teardown_confirmed:
          self._accept_status(raise_failure=False)
      elif self.start_requested:
        try:
          try:
            self.terminate()
          except OSError:
            try:
              self.control.shutdown(socket.SHUT_WR)
            except OSError:
              pass
          self.communicate(timeout=self.grace + 10, _closing=True)
        finally:
          # Even a lost/malformed final status must not skip awaiting the supervisor.
          self.process.wait(timeout=self.grace + 10)
      else:
        # No START was dispatched, so this known direct child cannot own a release tree.
        self.control.close()
        try:
          self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
          self.process.terminate()
          try:
            self.process.wait(timeout=1)
          except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=5)
        self.teardown_confirmed = True
    finally:
      self.closed = True
      for descriptor in (self.control, self.stdout, self.stderr):
        if descriptor is not None:
          descriptor.close()


def run_supervised(arguments, *, cwd, env, timeout=90):
  process = SupervisedProcess(arguments, cwd=cwd, env=env)
  try:
    process.start()
    stdout, stderr = process.communicate(timeout=timeout)
    return subprocess.CompletedProcess(arguments, process.returncode, stdout.decode(), stderr.decode())
  finally:
    process.close()
