# plan

- [plan](#plan)
  - [Scope](#scope)
  - [Implementation Plan](#implementation-plan)
    - [1. Reproduce the launch failure windows](#1-reproduce-the-launch-failure-windows)
    - [2. Guard the caller-side lifetime before start](#2-guard-the-caller-side-lifetime-before-start)
    - [3. Protect supervisor launch and initial handle acquisition](#3-protect-supervisor-launch-and-initial-handle-acquisition)
    - [4. Verify ownership and fixture retention](#4-verify-ownership-and-fixture-retention)
    - [5. Update relevant documentation and workflow metadata](#5-update-relevant-documentation-and-workflow-metadata)
    - [6. Run verification and record results](#6-run-verification-and-record-results)
  - [Acceptance Criteria](#acceptance-criteria)
  - [Risks And Decisions](#risks-and-decisions)

## Scope

Resolve only R1 in `tasks/02-fix-release-review-warnings/5-code-review.md`: cleanup ownership begins too late in the common caller and supervisor launch paths. Change test-harness implementation and regression tests, with relevant documentation and conventional source-version metadata. Do not modify production release protocol scripts, application behavior, Docker/Compose/migrations, or the separate T5 forced-cleanup-observability policy. No publication, remote mutation, real credential access, privileged setup, or destructive recovery belongs to this task. This planning stage creates only this plan.

## Implementation Plan

### 1. Reproduce the launch failure windows

1. During implementation, create a new branch named exactly `03-fix-launch-ownership` from the current task lineage. Preserve the unrelated modified `next-env.d.ts`, existing task reports, and all user work; do not touch `todo.md`.
2. Add synchronized failing regressions in `tests/test_release_supervision.py` for the two reviewed windows: losing the `started` acknowledgement after the release actually launches, and failure of the supervisor's initial root `pidfd_open` after `Popen` succeeds. Use injected local faults, sentinel files, barriers/control pipes, and harmless children; no service or daemon is needed.
3. Before the fix, demonstrate the live owned child rather than only asserting that `close()` was not called. Give the regression fixture an outer cleanup owner so reproducing the bug cannot itself leave processes running. Test-only imports of supervisor internals must remain inside isolated subprocesses; never enable subreaper behavior in the unittest runner.

### 2. Guard the caller-side lifetime before start

1. Refactor `tests/release_test_support.py` so `run_supervised` owns cleanup before invoking `start()`, using an explicit `try/finally` or equivalent lifetime guard. Make direct context-manager use equally safe when `__enter__` raises; Python does not call `__exit__` in that situation. Reuse the same guarded startup path from `BashPublicationTests.start_release` without duplicate launches or cleanup.
2. Distinguish supervisor creation/readiness, a start request that may have been dispatched, a received launch acknowledgement, and confirmed teardown. Mark start as possibly dispatched before writing the request. Failure to receive `started` is not proof that no root exists, and `started == False` must not select a no-child cleanup path after dispatch.
3. On acknowledgement timeout, malformed/unexpected acknowledgement, send/receive failure, or interruption during start, request cancellation or close the control writer as appropriate, drain bounded output/control traffic, and wait for the supervisor's final teardown outcome. Handle an outstanding `started` message during cancellation instead of mistaking it for final completion. Do not retry launch or depend on object destruction, garbage collection, or a delayed socket close to cancel it.
4. Cover partial construction too: if socket creation, supervisor `Popen`, or the readiness handshake fails, close only initialized descriptors and reap any created supervisor. Readiness/setup failure before start must never launch a release. Make cleanup idempotent so explicit guards, context exit, and unittest cleanup can safely converge.
5. Preserve the original launch exception when teardown succeeds. If teardown fails or cannot be proved within its bounded deadline, raise an explicit `SupervisionError` chained to the launch failure, retain sanitized ownership diagnostics, and trigger fixture retention. Error reporting must not say cleanup completed without evidence. Keep the existing ordinary 90-second execution timeout and separate bounded teardown deadlines.

### 3. Protect supervisor launch and initial handle acquisition

1. In `tests/release_supervisor.py`, initialize optional root/handle/ownership state before launching anything. Put root `Popen`, initial root-handle acquisition, and the `started` announcement inside the teardown-protected lifecycle. Cleanup must accept no root, a root without a pidfd, and a fully acknowledged root; do not close uninitialized handles or lose the original failure through a secondary cleanup exception.
2. When root pidfd acquisition fails, the supervisor still owns a known direct child. Permit signaling that exact child through a guarded direct-child path while its unreaped-child identity reserves its PID. Keep reaping and signaling decisions in the dedicated supervisor; after the child has been reaped, do not signal its numeric PID. Do not generalize this exception into raw-PID signaling for discovered descendants.
3. Retain invocation-local subreaper adoption, ancestry-checked descendant acquisition, PID-file-descriptor signaling for descendants, bounded graceful/escalation cleanup, and `waitpid` reaping. Initial root acquisition failure is not the discovery `EINVAL`/`ESRCH` retry case and must remain a launch failure. Failure must not be reclassified as a harmless unsupported-capability skip after a root has launched.
4. Keep best-effort cleanup bounded under resource exhaustion. If persistent `EMFILE` or another acquisition failure prevents safely obtaining descendant handles or proving complete reaping, report incomplete teardown and retain the fixture; never claim unconditional cleanup or signal unverified descendants to force success. Preserve output/control separation and fixed, sanitized diagnostics.
5. Report launch failure only after teardown completion is proved or its explicit deadline is exhausted. Do not send successful completion merely because the lock owner exited. Permit safe containment when the observer disappears; cancellation/EOF must not make the supervisor exit before handling its owned tree.

### 4. Verify ownership and fixture retention

1. Add acknowledgement-loss cases after a readiness/start barrier proves that the child exists, including a child in another session and a descendant that ignores SIGTERM. Verify bounded escalation, adoption/reaping, pipe closure, and lock release before the caller receives the launch exception. Also cover acknowledgement failure before any root is launched, so cleanup handles both states without inventing a child.
2. Inject a one-time initial root-handle failure such as `EMFILE` while allowing subsequent cleanup operations to work. Assert that the root and any synchronized descendants are stopped and reaped before failure acknowledgement. Add root `Popen` failure and partial-constructor/readiness failure cases to verify descriptor cleanup and no launch replay.
3. Simulate an incomplete teardown result and assert that `SupervisionError` reaches `BashPublicationTests` and suppresses temporary-fixture finalization. Keep the regression's own outer owner responsible for actual test processes; do not manufacture a real unkillable process or modify shared runner limits. Confirm the original launch failure remains available as exception context.
4. Keep an unrelated control process alive through the fault probes. Use ownership and kernel/process assertions, not only mocked call counts, to prove cleanup. Retain present/absent temporary-parent behavior, discovery-race handling, sentinel protection, and existing cooperative/escalation regressions.
5. Leave `CompletedProcess` success-result shape, normal forced-cleanup reporting, and ordinary publication assertions unchanged except where necessary to route startup through the guarded lifetime. Do not implement T5's new result/evidence policy or claim T5 resolved. If R1 requires a broader policy change, report the conflict before extending scope.

### 5. Update relevant documentation and workflow metadata

1. Update `docs/release-adaptations.md` and `docs/verification.md` with guarded launch ownership, failure/retention semantics, and targeted regression commands. Keep README changes limited to a relevant existing documentation pointer. Maintain tables of contents for edited/new Markdown; no consolidated guide is needed.
2. Keep test implementation changes separate from production protocol provenance. Do not change `scripts/release.sh`, `scripts/release-common.sh`, `scripts/release-data.py`, or their adapted hashes merely for this harness fix. Preserve upstream baseline evidence and historical task 02 results; record new results in this task instead.
3. Follow the implementation workflow's source patch-version convention without changing runtime behavior: provisionally advance `VERSION`, `package.json`, and both root lockfile version fields from `0.7.9` to `0.7.10`, add matching `docs/releases/0.7.10.md`, and update the configured notes path and operator-document link. This is bookkeeping for a test-only code fix, not a published/reserved version or a protocol alteration. Inspect intervening local metadata changes before choosing the next patch, and keep authenticated remote version inventories deferred to any future publication task.
4. Explicitly leave T5 and all existing image/runtime/browser/service readiness gates outstanding. Do not change generated `AGENTS.md`, provision credentials, run production/disposable databases, install host capabilities, or use live publication as verification.

### 6. Run verification and record results

1. Run the focused launch-ownership regressions first, then `python3 -B -m unittest tests.test_release_supervision -v` and existing interface/helper/consumer/adaptation tests. Require actual Linux supervision capability on the verification host before marking R1 resolved; capability skips are not passing ownership evidence.
2. Run `python3 -B -m unittest discover -s tests -v` from the project root. Retain all 139 current methods/scenarios, add the new launch-failure cases, and record exact counts, timings, skips, failures, and retries. Do not weaken assertions, increase the ordinary timeout, or silently substitute a targeted retry for a clean full-suite run.
3. Run `bash -n scripts/release.sh scripts/release-common.sh`, missing-token `./scripts/release.sh --validate`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Confirm version/notes/npm agreement, unchanged protocol/fake-port hashes, working local documentation links, and no validation side effects. Preserve the pre-existing `next-env.d.ts` modification if verification regenerates declarations.
4. Application-image builds, database-backed browser runs, and remote inventories are not acceptance requirements for this narrowly scoped harness change. Report their existing outstanding status without inferring runtime or publication success from local tests.
5. Write `tasks/03-fix-launch-ownership/4-implemented.md` with R1's disposition, fault/proof boundaries, commands/results, fixture retention outcomes, and remaining T5/readiness limits. Commit only task-owned test code, relevant docs, conventional metadata, and results; leave unrelated work untouched.

## Acceptance Criteria

- Failure before start does not launch a release. Once start may have been dispatched, every caller exit path actively owns bounded cancellation and teardown rather than relying on acknowledgement, context-manager exit after failed entry, or garbage collection.
- Root launch and initial pidfd acquisition are inside protected supervisor ownership. Known direct-child cleanup is safe without a root pidfd, descendants remain ancestry/pidfd-owned, and no unverified PID or unrelated process is signaled.
- Synchronized acknowledgement-loss and initial-root-handle-failure regressions prove owned termination/reaping, lock release, and bounded descriptor/output cleanup before failure delivery. Incomplete teardown instead produces explicit diagnostic failure and retained fixtures; original exceptions are preserved.
- Partial setup and repeated cleanup are safe, existing 90-second execution and bounded teardown limits remain, all existing scenarios stay covered, and the complete release suite passes or precise blockers prevent claiming R1 resolved.
- Production protocol bytes and hashes, T5 behavior, application behavior, Docker/Compose/migrations, and historical task records remain unchanged. Related docs and source-version bookkeeping are accurate and do not claim publication or readiness.
- No privileged setup, real credential access, remote writes, source push, live publication, broad process cleanup, or deletion of unrelated work occurs.

## Risks And Decisions

- `__exit__` is not called if `__enter__` raises. Cleanup registration must precede dispatch and cover partially constructed objects; adding another outer `with` without changing ownership is insufficient.
- The root-without-pidfd fallback is limited to an owned, unreaped direct child in the dedicated supervisor. Discovered descendants still require verified ownership and PID-safe handles. Resource exhaustion may make proof impossible; explicit retention is safer than an unsafe signal or a false cleanup claim.
- Recovery after acknowledgement loss may encounter stale launch messages or an unavailable observer. Keep launch and teardown protocol states distinct, do not replay start, and bound every wait while still preserving original failure evidence.
- T5 is intentionally deferred. Completing R1 does not establish that ordinary tests expose unexpected forced cleanup, nor does it certify image builds, browser behavior, authenticated remote version availability, or clean pushed-main readiness.
- Source `0.7.10` is provisional bookkeeping only. The change to the configured notes path changes future publication identity, but no existing publication may be adopted, rewritten, or repaired by this task.
