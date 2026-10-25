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
    self.status = None
    self.returncode = None
    self.buffer = bytearray()
    self.output = {"stdout": bytearray(), "stderr": bytearray()}
    self.control, child_control = socket.socketpair()
    self.control.setblocking(False)
    script = Path(__file__).with_name("release_supervisor.py")
    self.process = subprocess.Popen(
      [sys.executable, "-B", str(script), str(child_control.fileno()), str(grace),
       "fail" if fail_setup else "ready", *map(str, arguments)],
      cwd=cwd, env=env, pass_fds=(child_control.fileno(),),
      stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    child_control.close()
    self.stdout, self.stderr = self.process.stdout, self.process.stderr
    try:
      message = self.receive(time.monotonic() + 5)
      if message["event"] == "unsupported":
        raise unittest.SkipTest(message["reason"])
      if message["event"] != "ready":
        raise SupervisionError("Supervisor setup failed before release launch")
    except BaseException:
      self.control.close()
      self.process.wait(timeout=5)
      self.stdout.close()
      self.stderr.close()
      raise

  def receive(self, deadline):
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
    self.send("start")
    message = self.receive(time.monotonic() + 5)
    if message["event"] != "started":
      raise SupervisionError("Release did not start")
    self.pid = message["pid"]
    self.started = True
    return self

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

  def communicate(self, timeout=90):
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
    self.status = self.receive(time.monotonic() + self.grace + 10)
    self.process.wait(timeout=5)
    if self.status["event"] != "complete":
      (self.cwd / f"supervision-failure-{self.process.pid}.json").write_text(json.dumps(self.status))
      raise SupervisionError("Owned process teardown incomplete; retain fixture: " + self.status.get("reason", "deadline"))
    self.returncode = self.status["returncode"]
    if self.status["forced"]:
      for value in self.status["directories"]:
        path = Path(value)
        if path.parent != self.cwd or path.is_symlink() or not path.name.startswith("bash-release."):
          raise SupervisionError("Unsafe forced-cleanup path")
        if path.exists():
          shutil.rmtree(path)
    stdout, stderr = (bytes(self.output[name]) for name in ("stdout", "stderr"))
    if failure:
      raise failure
    if expired:
      raise subprocess.TimeoutExpired(self.arguments, timeout, output=stdout, stderr=stderr)
    return stdout, stderr

  def close(self):
    try:
      if self.status is None and self.started:
        self.terminate()
        self.communicate(timeout=self.grace + 10)
      elif not self.started and self.process.poll() is None:
        self.control.close()
        self.process.wait(timeout=5)
    finally:
      self.control.close()
      self.stdout.close()
      self.stderr.close()


def run_supervised(arguments, *, cwd, env, timeout=90):
  with SupervisedProcess(arguments, cwd=cwd, env=env) as process:
    stdout, stderr = process.communicate(timeout=timeout)
    return subprocess.CompletedProcess(arguments, process.returncode, stdout.decode(), stderr.decode())
