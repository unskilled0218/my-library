# Release adaptations

- [Release adaptations](#release-adaptations)
  - [Baseline and current bytes](#baseline-and-current-bytes)
  - [Protocol fixes](#protocol-fixes)
  - [Test adaptations](#test-adaptations)
  - [Launch ownership](#launch-ownership)
  - [Verification and review status](#verification-and-review-status)

## Baseline and current bytes

The immutable upstream baseline is container-release-template [commit 5b918ba0aefb9ac9643fa99976140c95d17cb3e2](https://git.lan/dev/container-release-template/src/commit/5b918ba0aefb9ac9643fa99976140c95d17cb3e2), template version 0.6.1. The current files include deliberate downstream patches; they are not unchanged upstream copies. No managed updater or unreviewed upstream upgrade runs.

Original upstream SHA-256 evidence is retained here and in `UPSTREAM_BASELINE_HASHES` in `tests/test_consumer_release.py`:

- `scripts/release.sh`: `70c7cd8178760bc3772334f7855a4c4ce912fe8cff7ddab8de33614a431ac70b`.
- `scripts/release-common.sh`: `34ff0197f467994267beede70083a00dea69c2b8c7b24b966bb2e021a3cfaa9b`.
- `scripts/release-data.py`: `db250d7f6a0f6b419a9aeb9dcebec1a487c175f1901074b1039e19fcf9b2e5fa`.
- `tests/fixtures/bash_release_ports.py`: `c0c3cd8c3691db155f4c53538b3fe1d13b9f4ec9c3ccc19aa52f6cb509d3f153`.

`ADAPTED_HASHES` checks the current protocol and fake-port bytes separately. For a future reviewed patch, retain the upstream hashes, inspect the exact diff, rerun safety regressions, update only the affected adapted hashes, and record the adaptation. Hash assertions detect drift; they do not replace review. Protocol changes alter annotated publication identity. Keep the original checkout/pin for historical retries; new scripts cannot adopt evidence bound to old script hashes.

## Protocol fixes

N1: `release.sh` marks promotion confirmed only after the explicit alias read proves the prepared digest. `alias_guard` then accepts only that digest, including immediately before release POST. Earlier predecessor/prepared acceptance remains unchanged. Restoration of the predecessor, disappearance, foreign state, and failed/invalid reads stop before subsequent writes. This is not an atomic cross-service operation; exclusive writers remain mandatory. No rollback is introduced.

N2: `release-data.py` preserves ordered `cliPluginsExtraDirs` and bridges only the original config-local `docker-buildx` candidate through an absolute symlink. Relative discovery paths retain the invocation directory's semantics. Original Docker JSON is bounded to 1 MiB and strictly parsed. An unusable selected candidate or invalid discovery setting is refused. System discovery remains available when no higher-priority candidate exists. Referenced executable paths remain trusted operator inputs; concurrent binary replacement is outside this guarantee.

The private configuration still excludes original registry credentials, `credsStore`, `credHelpers`, and unrelated configuration fields. Context/TLS metadata, host/context precedence, and Buildx state selection remain separate contracts. Native marker-plugin tests use the real Docker CLI but no daemon, registry, login, or actual user token.

## Test adaptations

The root test layout and original safety scenarios remain. The earlier template-only README assertion follows the consumer operator document. The fake ports now inject post-confirmation alias faults. Added regressions cover native CLI discovery, invalid settings, timeout supervision, and portable temporary roots.

`tests/release_test_support.py` prefers an existing writable `/tmp/opencode` directory but falls back to Python's platform temporary directory. Tests simulate absent preferred paths inside owned fixtures; they do not remove shared directories.

Each supervised release invocation has its own Linux child-subreaper process, not a runner-wide process setting. A readiness/start handshake establishes adoption before launch. Graceful cancellation first signals the lock owner; bounded escalation uses PID file descriptors for descendants across sessions and reaps adopted children before completion. A disappearing or invalid `/proc` candidate (`ESRCH` or `EINVAL` during handle acquisition) is discarded without signaling and retried through discovery/adoption; other acquisition failures remain fatal. Control-channel closure also requests teardown. Output/control traffic is separate and bounded. Normal completion preserves release output and the existing 90-second execution limit.

On cooperative exit, production traps must remove run-owned paths. If SIGKILL prevented traps, the harness removes only verified `bash-release.*` directories under its disposable fixture after successful reaping. Incomplete teardown retains the fixture and reports infrastructure failure. No global process-name killing, privileged installation, or shared temporary-directory cleanup occurs. Linux `/proc`, child-subreaper support, and Python/kernel PID-file-descriptor signaling are required; an unavailable capability is explicitly skipped and cannot certify the fix.

## Launch ownership

The test client now owns cleanup before sending START. A request that may have been dispatched is tracked separately from a received launch acknowledgement. Failed context entry, missing/unread/malformed acknowledgements, interruption, and partial construction all use the same bounded lifetime guard; neither garbage collection nor `__exit__` after failed `__enter__` is relied on. Cancellation consumes any outstanding `started` message before interpreting final teardown evidence. Original launch exceptions are preserved when teardown succeeds; unproved cleanup raises a chained `SupervisionError` and retains the fixture.

The dedicated supervisor protects root `Popen`, initial pidfd acquisition, and launch announcement inside the owned lifecycle. It can clean up a known unreaped direct child even if that child's initial pidfd could not be acquired; the child's reserved identity makes this a narrow direct-child exception, not permission to signal discovered descendants by raw PID. Descendants still require verified ancestry/pidfds and subreaper adoption. Resource exhaustion that prevents complete proof produces bounded incomplete-teardown evidence, not success or a post-launch capability skip.

Setup before START cannot launch a release. Cleanup is idempotent across caller guards, direct context-manager use, and unittest finalizers. Successful and nonzero-exit output, the ordinary 90-second execution limit, and existing forced-cleanup behavior are unchanged. The separate T5 warning about exposing forced teardown to ordinary publication assertions is intentionally not addressed by this launch-ownership change.

## Verification and review status

Targeted N1/N2 regressions reproduced the old guard and plugin-switch failures, then passed after the patches. Native tests exercise actual Docker CLI candidate precedence, not just equal version strings or fake Docker routing. Supervision regressions cover cooperative timeout, an orphan in another session ignoring SIGTERM while holding a pipe and lock, explicit cancellation, control-channel EOF, output bounds, capability refusal, and an unrelated process that must survive. Portable-parent tests perform real fixture creation and representative consumer/bearer checks in both selection modes.

Full release discovery passed all 139 methods with no skips, including the 125 original scenarios and added regressions. Two earlier runs exposed supervisor acquisition errors; the reproduced `EINVAL` race was fixed without weakening safety assertions or execution timeouts. See [verification](verification.md#release-workflow-checks) for commands and `tasks/02-fix-release-review-warnings/4-implemented.md` for detailed results. These are local adaptations awaiting code review, not a release-readiness waiver. Image-build crashes, architecture-specific runtime checks, database-backed browser acceptance, authenticated version inventory, exclusive writers, and clean already-pushed `main` remain separate gates. No live publication is performed by these tests.
