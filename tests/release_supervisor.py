"""Private subreaper entry point. Never imported into the unittest runner."""

import ctypes
import errno
import json
import os
from pathlib import Path
import select
import signal
import socket
import subprocess
import sys
import time


def enable_subreaper():
  if sys.platform != "linux" or not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
    raise OSError("Linux subreaper and PID-file-descriptor signaling are required")
  libc = ctypes.CDLL(None, use_errno=True)
  state = ctypes.c_int()
  if libc.prctl(36, 1, 0, 0, 0) != 0 or libc.prctl(37, ctypes.byref(state), 0, 0, 0) != 0 or state.value != 1:
    raise OSError("Cannot enable invocation-local child subreaper")
  # Direct-child fallback relies on zombies retaining their PID until this supervisor reaps them.
  signal.signal(signal.SIGCHLD, signal.SIG_DFL)
  descriptor = os.pidfd_open(os.getpid())
  try:
    signal.pidfd_send_signal(descriptor, 0)
  finally:
    os.close(descriptor)


def identity(pid):
  try:
    fields = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
    return int(fields[1]), fields[19]
  except (FileNotFoundError, ProcessLookupError):
    return None


def acquire_pidfd(pid):
  try:
    return os.pidfd_open(pid)
  except OSError as error:
    # A /proc candidate can disappear or cease being a valid process leader before acquisition.
    # Do not signal it by PID: a later ancestry scan or subreaper adoption must establish ownership.
    if error.errno in (errno.ESRCH, errno.EINVAL):
      return None
    raise


def discover(handles):
  """Only acquire pidfds for children reachable from this dedicated supervisor."""
  parents = [os.getpid()]
  visited = set(parents)
  while parents:
    parent = parents.pop()
    try:
      tasks = list(Path(f"/proc/{parent}/task").iterdir())
    except (FileNotFoundError, ProcessLookupError):
      continue
    for task in tasks:
      try:
        children = (task / "children").read_text().split()
      except (FileNotFoundError, ProcessLookupError):
        continue
      for value in children:
        pid = int(value)
        if pid in visited:
          continue
        visited.add(pid)
        before = identity(pid)
        if before is None or before[0] != parent:
          continue
        fd = acquire_pidfd(pid)
        if fd is None:
          continue
        after = identity(pid)
        if after != before:
          os.close(fd)
          continue
        old = handles.get(pid)
        if old is not None:
          os.close(old)
        handles[pid] = fd
        parents.append(pid)


def send_signal(fd, number):
  try:
    signal.pidfd_send_signal(fd, number)
  except ProcessLookupError:
    pass


def signal_owned_root(root, root_handle, number):
  if root is None:
    return
  if root_handle is not None:
    send_signal(root_handle, number)
  elif root.returncode is None:
    # This single-threaded supervisor has not reaped its direct child, so its PID is reserved.
    # This fallback must never be used for discovered descendants.
    try:
      os.kill(root.pid, number)
    except ProcessLookupError:
      pass


def emergency_teardown(root, root_handle, handles, deadline):
  while time.monotonic() < deadline:
    try:
      discover(handles)
    except OSError:
      # Resource exhaustion cannot authorize raw-PID signals to unverified descendants.
      pass
    signal_owned_root(root, root_handle, signal.SIGKILL)
    for fd in handles.values():
      send_signal(fd, signal.SIGKILL)
    try:
      while True:
        pid, status = os.waitpid(-1, os.WNOHANG)
        if pid == 0:
          break
        if root is not None and pid == root.pid:
          root.returncode = os.waitstatus_to_exitcode(status)
        if pid in handles:
          os.close(handles.pop(pid))
    except ChildProcessError:
      return True
    time.sleep(.01)
  return False


def supervise(channel, grace, arguments):
  def report(value):
    try:
      channel.sendall(json.dumps(value).encode() + b"\n")
    except (BrokenPipeError, ConnectionResetError):
      # Loss of the observer must not terminate the supervisor before teardown.
      pass

  report({"event": "ready"})
  channel.settimeout(5)
  request = channel.recv(64)
  if not request.startswith(b"start\n"):
    os.close(1)
    os.close(2)
    report({"event": "complete", "returncode": None, "forced": False, "directories": [], "reaped": True})
    return True
  channel.setblocking(False)
  root = root_handle = None
  handles = {}
  cancelled = None
  forced = False
  root_code = None
  directories = set()
  received = request[len(b"start\n"):]
  control_open = True
  try:
    existing_directories = set(Path.cwd().glob("bash-release.*"))
    root = subprocess.Popen(arguments, stdin=subprocess.DEVNULL)
    root_handle = os.pidfd_open(root.pid)
    report({"event": "started", "pid": root.pid})
    if b"cancel\n" in received:
      cancelled = time.monotonic()
      signal_owned_root(root, root_handle, signal.SIGTERM)
    while True:
      discover(handles)
      for path in Path.cwd().glob("bash-release.*"):
        if path not in existing_directories and path.is_dir() and not path.is_symlink():
          directories.add(str(path.absolute()))
      while True:
        try:
          pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
          pid = -1
        if pid <= 0:
          break
        if pid == root.pid:
          root_code = os.waitstatus_to_exitcode(status)
          root.returncode = root_code
        if pid in handles:
          os.close(handles.pop(pid))
      if pid == -1:
        break
      now = time.monotonic()
      if control_open and select.select([channel], [], [], .01)[0]:
        try:
          chunk = channel.recv(64)
        except ConnectionResetError:
          chunk = b""
        received = (received + chunk)[-64:]
        if not chunk or b"cancel\n" in received:
          control_open = bool(chunk)
          if cancelled is None:
            cancelled = now
            signal_owned_root(root, root_handle, signal.SIGTERM)
      elif not control_open:
        time.sleep(.01)
      if root_code is not None and cancelled is None:
        # A root that exits while holding descendants still needs bounded teardown.
        cancelled = now
      if cancelled is not None and now - cancelled >= grace:
        forced = True
        for fd in handles.values():
          send_signal(fd, signal.SIGKILL)
        if now - cancelled >= grace + 5:
          report({"event": "incomplete", "owned": list(handles), "directories": sorted(directories)})
          return False
    # Release descendants have all been reaped; close inherited output before acknowledgement.
    os.close(1)
    os.close(2)
    report({"event": "complete", "returncode": root_code, "forced": forced,
            "directories": sorted(directories), "reaped": True})
    return True
  except BaseException as error:
    # Infrastructure errors still require bounded adoption and teardown, never an early exit.
    reaped = emergency_teardown(root, root_handle, handles, time.monotonic() + 5)
    frame = error.__traceback__
    while frame.tb_next is not None:
      frame = frame.tb_next
    reason = f"{type(error).__name__} errno={getattr(error, 'errno', None)} line={frame.tb_lineno}"
    os.close(1)
    os.close(2)
    report({"event": "failed" if reaped else "incomplete", "reason": reason, "reaped": reaped,
            "returncode": root.returncode if root is not None else None, "forced": root is not None,
            "owned": list(handles), "directories": sorted(directories)})
    return reaped
  finally:
    if root_handle is not None:
      os.close(root_handle)
    for fd in handles.values():
      os.close(fd)


if __name__ == "__main__":
  control_fd, grace, setup, *arguments = sys.argv[1:]
  channel = socket.socket(fileno=int(control_fd))
  try:
    if setup == "fail":
      raise OSError("Simulated unavailable supervision capability")
    enable_subreaper()
  except OSError:
    try:
      channel.sendall(json.dumps({"event": "unsupported", "reason":
                      "Linux /proc, child subreaper, and PID-file-descriptor supervision unavailable"}).encode() + b"\n")
    except OSError:
      pass
    sys.exit(1)
  else:
    try:
      reaped = supervise(channel, float(grace), arguments)
      sys.exit(0 if reaped else 1)
    except OSError as error:
      try:
        channel.sendall(json.dumps({"event": "incomplete", "reason":
                        f"{type(error).__name__}: errno {error.errno}"}).encode() + b"\n")
      except OSError:
        pass
  finally:
    channel.close()
