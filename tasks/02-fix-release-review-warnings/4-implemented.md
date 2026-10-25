# Implementation results

- [Implementation results](#implementation-results)
  - [Outcome](#outcome)
  - [Changes](#changes)
  - [Verification passed](#verification-passed)
  - [Earlier verification failures](#earlier-verification-failures)
  - [Remaining release gates](#remaining-release-gates)
  - [Workspace and provenance](#workspace-and-provenance)

## Outcome

Implemented the four warning remediations on new branch `02-fix-release-review-warnings`, using provisional source version `0.7.9`. Full release discovery passed all 139 methods with no skips, retaining all 125 original scenarios. Targeted protocol, native-plugin, supervision, portability, and application checks also pass. The changes await code review; no live publication or unconditional production-readiness claim is made.

## Changes

- N1: promotion confirmation now tightens `alias_guard` to accept only the prepared digest. The earlier predecessor/prepared guard remains available before promotion. New precise fake-port injections cover predecessor restoration, disappearance, foreign state, transport/timeout failure, malformed/oversized data, and null evidence before release creation.
- N2: private authentication preserves ordered `cliPluginsExtraDirs` and only the original config-local Buildx candidate through an absolute symlink. Relative discovery references retain caller-directory semantics. Original config parsing is strict and bounded; invalid discovery settings or an unusable selected candidate refuse instead of exposing a different system plugin. Unrelated credentials/helpers/configuration remain excluded. Native tests use the actual Docker CLI with harmless marker plugins and no daemon access.
- Timeout ownership: publication tests now launch through a dedicated per-invocation Linux child-subreaper, established through a readiness/start handshake. Graceful cancellation signals the lock owner. Escalation uses descendant ownership and PID file descriptors across sessions, reaps adopted children, bounds output/control waits, and distinguishes cooperative trap cleanup from forced cleanup after reaping. An unrelated process and pre-existing fixture paths are protected by regression assertions.
- Portability: publication, consumer, and bearer fixtures share a temporary-parent policy that prefers existing writable `/tmp/opencode` and otherwise uses Python's platform temporary directory. Present/absent cases create real fixtures and execute representative consumer/helper assertions without changing the shared directory.
- Provenance: upstream baseline `5b918ba0aefb9ac9643fa99976140c95d17cb3e2` and its original hashes remain recorded separately from current downstream hashes. Added `docs/release-adaptations.md`, updated operator/recovery/verification documents, and added a relevant README link. Historical task reports and original release notes remain unchanged.
- Metadata: synchronized `VERSION`, npm/lockfile fields, configured notes, operator link, and new `docs/releases/0.7.9.md`. No remote version reservation or availability claim follows from this source bump.

## Verification passed

- `python3 -B -m unittest discover -s tests -v`: the final complete run passed all 139 methods in 874.457 seconds with no skips. This includes all original publication/association scenarios and the added protocol, native-discovery, supervision, and portability regressions. The final log is `/tmp/opencode/my-library-task02-full-fixed.log`.
- Initial red protocol/native run: five test methods intentionally failed on the old code, including predecessor/absence allowing release POST, config-local/extra-directory plugin switching, and unusable-candidate fallback. Baseline invalid-setting subcases also produced setup errors after the old helper created the repeated work directory. Assertions were retained; the fix validates discovery before creating private auth state.
- After the protocol patches, `python3 -B -m unittest tests.test_release_adaptations -v`: five methods passed in 46.747 seconds, including all eight promotion-fault subcases and the native plugin checks then present.
- Initial supervision/portability/protocol plus existing progress/signal regressions: 14 methods passed in 54.963 seconds. The existing signal test verifies actual release-lock forwarding and trap cleanup, complementing the synthetic orphan-adoption regression.
- Final focused `tests.test_release_supervision`, `tests.test_release_adaptations.NativePluginTests`, and `tests.test_consumer_release`: 21 methods passed in 1.326 seconds, with no skips. This includes the additional system-only discovery case, synchronized intermediate-parent exit, PID-safe orphan teardown, lock release, bounded overflow, cancellation, unavailable-capability refusal, both temporary-parent modes, and injected transient/fatal PID-file-descriptor acquisition failures.
- A separate process-churn diagnostic passed 12 supervised invocations and 3,000 rapidly exiting child commands, with no supervision errors.
- Two additional diagnostics passed 200 supervised validation invocations and 200 supervised early-refusal invocations. A requested 70-invocation publication/retry diagnostic was interrupted by its 240-second tool limit; it is not counted as a passing verification run.
- After reproducing and fixing the PID-file-descriptor acquisition race, 30 fresh context-selected publication fixtures passed consecutively.
- `bash -n scripts/release.sh scripts/release-common.sh`: passed.
- `GIT_TOKEN=/missing/task02-token ./scripts/release.sh --validate`: passed without credentials or remote operations. The consumer regression separately checks no fake service commands or publication state are created.
- `npm run format:check`, `npm run lint`, and `npm run typecheck`: passed.
- `npm test`: 39 files and 253 tests passed.
- `npm run build`: production application build passed with Next.js 16.3.6.
- Subsequent `npx prettier --check .` and `git diff --check`: passed. Consumer checks verify metadata, current hashes, retained baseline evidence, diagnostic paths/fragments, and transitive adopted-document links.

## Earlier verification failures

- The first full `python3 -B -m unittest discover -s tests -v` executed 137 methods in 778.562 seconds: 133 passed and four errored with incomplete supervisor-teardown acknowledgements. Affected scenarios were config-selected context, wrong peeled tag, explicit named context, and Gitea 28.2.0 association prerequisites. Independent targeted retries of the first two passed. The earlier supervisor version did not preserve the underlying error type; no definitive root cause is claimed.
- The second complete run executed 138 methods in 853.177 seconds: 136 passed and two errored with supervisor `OSError` acknowledgements, affecting explicit builder selection and one refreshed-package-identity subcase. Enhanced diagnostics then reproduced `pidfd_open` returning `EINVAL` at descendant acquisition during repeated fresh context-selected publication fixtures. No raw-PID signal was substituted.
- The supervisor now treats `EINVAL` and `ESRCH` during discovery-handle acquisition as invalid/transient observations: discard them without signaling and retry through subsequent ownership scans or subreaper adoption. Other acquisition failures remain fatal. A deterministic injected-error regression checks both transient refusals and fatal permission failure. Setup capability checks still fail explicitly; they are not masked as transient discovery races.
- The third complete run passed all 139 methods in 874.457 seconds after the acquisition fix. New system-only discovery and acquisition-race methods account for the increased count. The two earlier failed runs remain documented above; no safety assertions or ordinary timeouts were relaxed to obtain the passing result.
- Hardened supervision during verification against `/proc` disappearance races, observer disconnection, and unexpected infrastructure failures. Added separate acknowledgement after inherited output closure and protection for pre-existing temporary paths. No assertion, normal timeout, supported platform, or publication-safety guard was relaxed.
- Full-run and targeted logs remain outside the repository under `/tmp/opencode/my-library-task02-*.log`. The final complete run, not targeted retries alone, establishes the clean local release-suite result. This is not live-publication or application-image acceptance evidence.

## Remaining release gates

The local N1/N2 changes await code review; tests are not a readiness waiver. The earlier image-build crashes, successful builds and runtime checks on both required architectures, disposable-database browser acceptance, authenticated remote version inventory, service permissions, exclusive writers, and clean already-pushed `main` remain separate outstanding release work. Workspace Chromium installation does not certify the application image. This task did not build/push images, run databases or browsers, provision/read actual credentials, push source, create remote tags/releases, associate packages, or perform privileged setup or destructive recovery.

## Workspace and provenance

The pre-existing modified `next-env.d.ts` remains excluded from task staging. `AGENTS.md`, application source, Dockerfile, Compose, migrations, and previous task reports were not changed. All service regressions use disposable fixture repositories, sentinel tokens, and fake command ports; native plugin probes run only harmless CLI discovery. Supervision capabilities are local to dedicated child processes, not the shared runner or host. Unsupported Linux capabilities are explicit skips and cannot certify timeout remediation. Incomplete teardown retains the affected fixture instead of deleting paths beneath live processes.
