# Implementation results

- [Implementation results](#implementation-results)
  - [Outcome](#outcome)
  - [Changes](#changes)
  - [Verification passed](#verification-passed)
  - [Verification notes](#verification-notes)
  - [Scope and remaining limits](#scope-and-remaining-limits)

## Outcome

Implemented R1 launch-ownership remediation on new branch `03-fix-launch-ownership`, with provisional source version `0.7.10`. Complete release discovery passed all 149 methods with no skips. Focused ownership, supervision, and application checks also pass. The implementation awaits code review; no publication or production-readiness claim is made. T5 remains intentionally outside scope.

## Changes

- The common wrapper now registers cleanup through an explicit lifetime guard before calling `start()`. Direct context-manager entry also cleans up when `__enter__` fails. Startup tracks a possibly dispatched request separately from an acknowledged child, so acknowledgement loss cannot select a no-child cleanup path.
- Constructor failures close initialized sockets/pipes and reap any pre-start supervisor. Cleanup is idempotent across start failure, explicit guards, context exit, and unittest finalizers. Cancellation drains outstanding `started` messages before accepting final teardown evidence. Original exceptions are preserved after proven cleanup; incomplete cleanup raises a chained `SupervisionError` and retains diagnostics/fixtures.
- Root launch, initial pidfd acquisition, and the launch announcement are inside the supervisor's protected lifetime. Optional root/handle state permits cleanup before or during acquisition. A root without a pidfd can be signaled only as the supervisor's known unreaped direct child; discovered descendants still require ancestry-checked pidfds. The dedicated supervisor explicitly restores default SIGCHLD handling so unreaped-child PID reservation and adoption/reaping assumptions remain valid.
- Emergency cleanup is bounded and reports a failed operation separately from incomplete teardown. A post-launch resource error is never reclassified as an unsupported-capability skip. Special publication-test startup propagates fixture retention when launch cleanup cannot be proved.
- Added ten launch-ownership test methods while retaining the existing 139. They cover consumed/unread/malformed acknowledgements, interruption, failed context entry, pre-dispatch send failure, socket/spawn/readiness failures, initial root-handle failure, synchronized separate-session descendants, lock release, unrelated-process isolation, idempotence, and simulated incomplete-proof fixture retention.
- Updated relevant README/documentation pointers and launch-ownership/verification guidance. Synchronized source version, npm/lockfile metadata, configured notes, operator link, and `docs/releases/0.7.10.md`. This bookkeeping does not reserve or publish the version.

## Verification passed

- `python3 -B -m unittest discover -s tests -v`: all 149 methods passed in 881.295 seconds with no skips, retaining all 139 previous methods and adding ten launch-ownership methods. Log: `/tmp/opencode/my-library-task03-full.log`.
- Before implementation, the two new R1 reproduction methods failed on the old code in 0.125 seconds: an acknowledged-live child survived failure delivery, and initial root acquisition failure escaped with its spawned child still alive. Outer fixture owners cleaned up those intentionally reproduced leaks.
- `python3 -B -m unittest tests.test_release_supervision -v`: the initial expanded 17-method suite passed in 1.394 seconds before the final malformed-ack/interruption method was added.
- The current 18 supervision methods plus existing publication progress/signal tests passed together: 20 methods in 12.463 seconds. Both original launch windows and real release-lock forwarding are exercised without services or a daemon.
- Final interface/helper/consumer/supervision verification passed 60 methods in 2.888 seconds, including the default-SIGCHLD safeguard, metadata agreement, unchanged adapted hashes, local documentation references, missing-token validation isolation, native-independent ownership tests, and temporary-root portability.
- `bash -n scripts/release.sh scripts/release-common.sh`: passed.
- `GIT_TOKEN=/missing/task03-token ./scripts/release.sh --validate`: passed with no credentials or remote operations.
- `npm run format:check`, `npm run lint`, and `npm run typecheck`: passed.
- `npm test`: 39 files and 253 cases passed.
- `npm run build`: production build passed with Next.js 16.3.6.
- `git diff --check`: passed. Production protocol scripts, fake command ports, and consumer provenance/hash assertions have no diff from the task base.

## Verification notes

- The complete 149-method release run passed. Targeted checks complement that full result rather than substituting for complete discovery.
- The explicit default-SIGCHLD safeguard and its isolated regression assertion were added while full verification was running. The final 60-method targeted rerun passed with that safeguard and assertion included.
- Logs remain outside Git under `/tmp/opencode/my-library-task03-*.log`. No old failed run or targeted retry is represented as a passing complete run.

## Scope and remaining limits

Only test-harness implementation, tests, relevant documentation, and conventional source metadata change. Production release protocol bytes, their hashes, fake ports, application source, Dockerfile/Compose/migrations, generated `AGENTS.md`, historical task reports, and the unrelated modified `next-env.d.ts` are preserved. Normal `CompletedProcess` results, ordinary forced-cleanup policy, and the 90-second execution limit remain unchanged; this task does not implement or close T5.

Persistent resource exhaustion can prevent safely acquiring descendant handles or proving teardown. In that case the contract is bounded explicit failure with retained diagnostics/fixtures, not unsafe raw-PID signaling or a false success acknowledgement. Regression simulations retain their own outer cleanup owners and do not change shared resource limits or create genuinely unkillable processes.

No real credentials were accessed, no network/service or daemon verification was used, and no source push, live publication, remote mutation, privileged installation, broad process kill, or destructive cleanup was performed. Image-build/runtime checks on both architectures, database-backed browser acceptance, authenticated remote version availability, exclusive writers, permissions, and clean already-pushed `main` remain separate release gates. Code review of R1 implementation is still required.
