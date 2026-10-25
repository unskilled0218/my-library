# Implementation results

- [Implementation results](#implementation-results)
  - [Outcome](#outcome)
  - [Changes](#changes)
  - [Verification passed](#verification-passed)
  - [Verification blocked or failed](#verification-blocked-or-failed)
  - [Publication gates](#publication-gates)
  - [Workspace and cleanup](#workspace-and-cleanup)

## Outcome

Implemented release-workflow adoption on new branch `01-update-build-image`, with source version `0.7.8`. No live release was attempted. Image-build and browser-runtime acceptance remain incomplete; this is not a production-readiness or publication-success claim.

## Changes

- Adopted `scripts/release.sh`, `scripts/release-common.sh`, and `scripts/release-data.py` unchanged from container-release-template commit `5b918ba0aefb9ac9643fa99976140c95d17cb3e2` (template 0.6.1). Consumer tests pin their SHA-256 hashes and the unchanged fake command fixture.
- Added schema-1 `scripts/release.json` targeting only `https://git.lan`, repository `dev/my-library`, image `git.lan/dev/my-library`, login `dev`, private `~/.config/git/token`, and AMD64/ARM64 platforms. No credentials were read, provisioned, or committed.
- Added authoritative root `VERSION`, synchronized package/lockfile metadata, and matching committed-source release notes at `docs/releases/0.7.8.md`.
- Kept the application Dockerfile, Prisma migration entrypoint, Chromium installation, non-root runtime, storage, health check, and image-context allowlist. Removed obsolete `BUILD_*` defaults: the reference supplies release OCI metadata through Buildx labels.
- Added `MY_LIBRARY_IMAGE` full-reference selection, with precedence over legacy `MY_LIBRARY_VERSION` and unchanged default `latest`. New publications use digest references, not version-tag image aliases.
- Copied root-layout upstream release tests; adapted only the README-specific test to the consumer operator documentation. Added eight consumer tests covering provenance, metadata, OCI wiring, allowlist, image selection, documentation dependencies, missing-token validation isolation, and removal of the inline-token interface. The helper still strips legacy token variables from child environments as a security measure.
- Added ignored release state and Python bytecode paths. Rewrote the release entry document, adopted dedicated configuration/process/platform/publication/image documents, preserved application verification guidance, and updated README/deployment documentation. Diagnostic paths and local link fragments are checked offline; historical upstream evidence uses immutable external references.

## Verification passed

- `npm ci`: completed. npm reported 10 dependency advisories (five moderate, four high, one critical), deprecation notices, and install-script approval warnings. Dependencies were not upgraded or automatically repaired outside this task.
- `npm run format:check`: passed.
- `npm run lint`: passed on resumed verification. The earlier native crashes did not reproduce; their cause remains undiagnosed.
- `npm run typecheck`: passed.
- `npm test`: 39 files and 253 tests passed.
- `npm run build`: production build passed with Next.js 16.3.6.
- `bash -n scripts/release.sh scripts/release-common.sh`: passed.
- `./scripts/release.sh --validate`: passed without reading a token or contacting services.
- `python3 -B -m unittest tests.test_bash_release.BashInterfaceTests tests.test_consumer_release -v`: all 13 tests passed, including all eight consumer checks and the adapted upstream document assertion.
- `python3 -B -m unittest tests.test_bash_release.BashDataTests -v`: all 29 data/helper tests passed, including bounded I/O, fatal guard failures, strict identities, registry evidence, and package-association contracts.
- A targeted retry of upstream `test_completed_retry_finishes_only_missing_link_then_becomes_read_only_gitea_28_2_0` passed independently.
- Targeted retries of the three affected cases from the 994.188-second full run all passed: fresh package publication, explicit builder selection, and the Gitea 28.2.0 association-prerequisite scenario (three tests in 127.343 seconds). No protocol or test assertion was changed for these retries; the intermittent full-run failures remain undiagnosed.
- Docker Compose rendered default `git.lan/dev/my-library:latest` and the explicit digest override with precedence over a conflicting legacy tag. Consumer tests also cover legacy selection.
- The selected Buildx builder advertises both required architectures. This is platform-advertisement evidence, not runtime proof.
- Applied all six Prisma migrations successfully to a new disposable `library_release_test_01` database before attempting browser tests.

## Verification blocked or failed

- The previous full `python3 -B -m unittest discover -s tests -v` run executed 125 tests in 994.188 seconds: 122 passed, two failed, and one errored. Fresh publication exceeded its 90-second subprocess timeout, explicit builder selection could not read the observed tag, and one association-prerequisite subcase stopped before its injected read. Initial consumer-test mistakes were corrected before this run. A full resumed rerun is in progress in `/tmp/opencode/my-library-release-tests-resumed.log`; no single clean full-suite run is claimed yet, and no upstream publication safety assertion or timeout was changed.
- `npm run test:e2e`: all 30 configured cases failed before browser execution because Chromium headless shell revision 1243 is missing. Database migration succeeded, but browser behavior was not tested. User installation is required: `npx playwright install chromium`; then rerun with a newly migrated disposable database.
- A no-push `docker buildx build --platform linux/amd64,linux/arm64 --output type=cacheonly ...` attempt failed at ARM64 `npm ci` with QEMU signal 11 / exit 139. A separate AMD64-only diagnostic build, without changing configured release platforms, failed at `npm run db:generate && npm run build` with a segmentation fault / exit 139. The workspace production build passes, but neither final image nor architecture-specific Prisma/Chromium runtime is certified.
- Resumed verification again passed formatting, type checking, all 253 unit tests, production build, shell syntax, and offline release validation. The repeated no-push dual-architecture image build failed during AMD64 Chromium system-dependency installation with `Segmentation fault (core dumped)`; the Dockerfile command and Buildx exited 1, and remaining build stages were canceled. Chromium revision 1243 is still absent from the workspace, so browser tests remain blocked pending user installation.
- No final image was available for startup, health, persistent-storage, or Chromium runtime verification. Native builder or emulation/runtime diagnosis is required; no privileged host setup or platform downgrade was performed.

## Publication gates

- The unchanged reference retains N1 (post-promotion guard can still accept the predecessor) and N2 (private Docker auth can lose config-local Buildx discovery). Live publication remains blocked pending the separately reviewed readiness decision or explicit new upstream pin required by the plan.
- This is an implementation branch with unrelated dirty work, not clean, already-pushed `main`. No source push, release invocation, registry push, Git tag creation, release POST, package link, alias promotion, remote deletion, or rollback was performed.
- Read-only `git ls-remote --tags origin` returned no tags and the public releases endpoint returned an empty array. The unauthenticated package-version lookup returned HTTP 401, so registry absence and version availability were not proved. `0.7.8` is a source version, not a reserved or published release; repeat complete authenticated inventories before publication.
- Provision credentials privately and verify actual service permissions and exclusive publication/package-association writers before any future live attempt. Do not interpret validation or fake-port success as permission to bypass gates.

## Workspace and cleanup

- Preserved and excluded the pre-existing `next-env.d.ts` modification from implementation staging. Verification-generated `AGENTS.md` and `CLAUDE.md` were inspected and left unstaged rather than adding unrelated project-agent configuration.
- Used only a task-owned temporary PostgreSQL container `my-library-release-db-01`, with tmpfs data and no published port. Removed that container after the blocked browser run; production/development database containers and volumes were not modified.
- Build attempts used local cache/local diagnostic image output only and never pushed. No image pruning or broad cleanup was performed.
- Detailed command logs are outside the repository under `/tmp/opencode/my-library-*.log`; they are not committed.
