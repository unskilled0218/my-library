# plan

- [plan](#plan)
  - [Scope](#scope)
  - [Implementation Plan](#implementation-plan)
    - [1. Pin and adopt the reference workflow](#1-pin-and-adopt-the-reference-workflow)
    - [2. Configure project identity and release inputs](#2-configure-project-identity-and-release-inputs)
    - [3. Preserve the application image](#3-preserve-the-application-image)
    - [4. Update deployment and operator documentation](#4-update-deployment-and-operator-documentation)
    - [5. Verify locally before publication](#5-verify-locally-before-publication)
    - [6. Publish and verify when ready](#6-publish-and-verify-when-ready)
  - [Acceptance Criteria](#acceptance-criteria)
  - [Risks And Decisions](#risks-and-decisions)

## Scope

Replace the existing custom release helper with the Bash workflow from `https://git.lan/dev/container-release-template`, configured for `dev/my-library` and `git.lan/dev/my-library`. Preserve the Next.js application image, support AMD64 and ARM64, and document the new configuration, version, credentials, deployment, and recovery contracts. This planning task changes no implementation code and performs no publication.

## Implementation Plan

### 1. Pin and adopt the reference workflow

1. Use reference commit `5b918ba0aefb9ac9643fa99976140c95d17cb3e2` (template version `0.6.1`) as the reviewed baseline. Record its provenance in `docs/publish-a-release.md`; do not silently consume later upstream changes.
2. Replace `scripts/release.sh` and add `scripts/release-common.sh` and `scripts/release-data.py` from that exact commit, preserving executable permissions where needed. Copy the matching upstream tests to root `tests/test_bash_release.py`, `tests/fixtures/bash_release_ports.py`, and `tests/__init__.py`; retain this layout so `Path(__file__).resolve().parents[1]` selects the project root and fixture lookup remains valid. Run them with `python3 -B -m unittest discover -s tests -v` from the project root.
3. Add `.template-operation.lock`, `.release-template/`, and `.template-transaction/` to `.gitignore`. Keep credentials and temporary publication state outside tracked source.
4. Retain the template's identity checks, committed-source snapshot, bounded reads, platform checks, deterministic tag evidence, staging reuse, digest promotion, and guarded package association. Do not reintroduce legacy token arguments, automatic source pushes, or destructive recovery.
5. Adapt only template-specific test assumptions: replace the upstream README version-string and release-notes-link assertions with checks that `docs/publish-a-release.md` links to the configured notes and documents root `VERSION` as authoritative. Keep the existing version/tag/notes assertions and all publication failure/retry regressions. Add consumer checks in `tests/test_consumer_release.py`, including agreement with npm metadata. Record test adaptations separately from protocol-script provenance; do not add a duplicate README version source or delete safety coverage to make tests pass.

### 2. Configure project identity and release inputs

1. Add schema-1 `scripts/release.json` with `gitea: https://git.lan`, `repository: dev/my-library`, `image: git.lan/dev/my-library`, `username: dev`, `token_file: ~/.config/git/token`, and platforms `linux/amd64` and `linux/arm64`. Set `notes` to the new committed release-notes path.
2. Introduce root `VERSION` as the authoritative release version. Current package metadata is `0.7.7`; use the next available patch version, provisionally `0.7.8`, after read-only checks of existing tags, releases, and image state. Never reuse an existing or ambiguous version.
3. Keep `package.json` and both root version fields in `package-lock.json` synchronized with `VERSION` as application metadata, not independent release sources. Add a local consistency regression check.
4. Create `docs/releases/<version>.md` beginning exactly `# Release v<version>`, describing the application release and release-workflow changes. Add a table of contents and keep notes within the template's size limit.

### 3. Preserve the application image

1. Keep the multi-stage Node 24 Bookworm Dockerfile, standalone Next.js output, Prisma client/migrations, production dependencies, Chromium installation, non-root user, storage directories, entrypoint, and health check. Do not copy the template's Hello World Dockerfile.
2. Align OCI metadata with the reference build command, which supplies version, revision, and source through `--label`, not the existing `BUILD_*` arguments. Remove misleading unused release arguments/default labels where appropriate while retaining the image title and ensuring final published labels match release evidence.
3. Review `.dockerignore` against the committed-source snapshot and all Dockerfile inputs. Preserve its allowlist so `.env`, task files, credentials, and release state never enter the application image.
4. Build both architectures and verify architecture-specific Prisma and Playwright dependencies. Confirm generated Prisma artifacts remain usable in the final image. Do not downgrade platforms or replace the runtime to bypass failures.

### 4. Update deployment and operator documentation

1. Rewrite `docs/publish-a-release.md` as a concise operator entry point with a table of contents, pinned provenance, root `VERSION` authority, a link to the configured versioned release notes, and links to dedicated configuration, process, platform, and recovery documents. Cover separate application checks and clean already-pushed `main` without duplicating detailed recovery policy.
2. Replace `FORGEJO_TOKEN`/`FORGEJO_USER` instructions with the private token file and optional `GIT_TOKEN` path / `GIT_USERNAME` overrides. Never read or print token contents during setup or diagnostics.
3. Explain that this workflow publishes a staging image, binds an immutable digest in an annotated Git tag, promotes `latest`, creates the notes-only Gitea release, and verifies the repository package link. It does not create the legacy `:v<version>` image alias.
4. Audit `docker-compose.yml`, `.env.example`, `docs/production-deployment.md`, and other deployment references for `MY_LIBRARY_VERSION` and version-tag assumptions. Preserve default `latest` deployment and explicitly document digest-pinned deployment; if retaining `MY_LIBRARY_VERSION` for legacy tags, label its limitation and add an explicit full-image override for digest references rather than claiming new version aliases exist.
5. Keep README changes limited to corrected links or quick-start commands. Put detailed release instructions in dedicated documentation.
6. Document Bash, Python 3.11+, Git, curl, Docker Buildx, trusted HTTPS, private token permissions, independent Git authentication, and supported Gitea association versions. Host emulation setup belongs to the user/administrator; do not run privileged installation commands.
7. Copy and adapt `docs/bash-configuration.md`, `docs/release-process.md`, `docs/platform-preparation.md`, `docs/bash-publication.md`, and `docs/image-usage.md` from the pinned reference. These cover the scripts' direct diagnostic targets and their transitive operational links. Retain the diagnostic anchors `#credentials-and-prerequisites`, `#troubleshooting`, and `#retry-states`, plus linked package-association, resource-limit, and known-limit sections. Preserve release-script diagnostic paths unchanged rather than altering protocol scripts solely to redirect documentation.
8. Adapt all copied examples to My Library: replace Hello World run commands with application/Compose guidance, preserve prerequisites and uncertainty warnings, and never present upstream live evidence as consumer verification. Merge relevant release-testing content into existing `docs/verification.md` without overwriting application verification instructions. Rewrite upstream archived-task references as immutable upstream URLs, including N1/N2 evidence, rather than copying task history or leaving broken local links. Keep tables of contents current in created or edited documents.
9. Inventory documentation references in all three release scripts and recursively check local links/anchors in the adopted documents. Add offline assertions in `tests/test_consumer_release.py` that every emitted local documentation target exists and its fragment resolves, including `docs/bash-configuration.md`, `docs/release-process.md#troubleshooting`, `docs/platform-preparation.md`, `docs/bash-configuration.md#credentials-and-prerequisites`, and `docs/bash-publication.md#retry-states`. Validate other adopted local links as well; do not require network access to check pinned external evidence URLs.

### 5. Verify locally before publication

1. Run `bash -n scripts/release.sh`, `bash -n scripts/release-common.sh`, `python3 -B -m unittest discover -s tests -v`, and `./scripts/release.sh --validate` from the project root. Unittest discovery must execute both the transplanted upstream suite and `tests/test_consumer_release.py`. Validation must require no token, Docker access, network access, or publication writes; test the missing-token case and assert no fake external commands or state creation occur.
2. Test consumer-specific contracts: correct repository/image identity, matching versions and notes, OCI label wiring, source allowlist, deployment image selection, and legacy-token removal. Use fake external tools for publication failure/retry checks; do not contact production for tests.
3. Run `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Account for vendored Python/shell files in formatter/linter scope without weakening application checks.
4. Run `npm run test:e2e` using the project's disposable database setup, never the production database. Separately verify image startup, migrations, health, persistent storage, and Chromium behavior on approved disposable infrastructure; distinguish build-manifest evidence from runtime execution on each architecture.
5. Preserve unrelated work, including the currently modified `next-env.d.ts`. Investigate and report unrelated failures rather than overwriting user changes or claiming a clean publication checkout.

### 6. Publish and verify when ready

1. Treat the reference's documented N1 alias-promotion guard warning and N2 config-local Buildx discovery warning as explicit readiness blockers for an unconditional production-readiness claim. Review upstream fixes at a new explicit pin or obtain a separately reviewed decision on applicability before live publication; do not silently change the pinned protocol or bypass guards.
2. Confirm the selected builder, trusted service endpoints, private credentials, Git authentication, target permissions, and exclusion of other repository/image/package-association writers. Missing tools or privileged host preparation must be reported to the user for installation.
3. After all release inputs are committed, publish only from clean `main` already pushed to the configured origin. A planning or implementation branch must not run publication. Preserve unrelated dirty changes rather than clearing them to satisfy the check.
4. Run `./scripts/release.sh` only after readiness gates pass. Verify the final reported immutable digest, both platform manifests and labels, exact annotated tag/source, `latest` digest, notes-only release, and package association with `dev/my-library` before reporting success.
5. On partial or uncertain failure, preserve accepted remote objects and the original checkout/pin. Record the failed stage and inspected evidence; do not delete tags/images, roll back `latest`, reassign packages, or blindly retry ambiguous tag-only/release-only states.

## Acceptance Criteria

- Only this task's `2-plan.md` changes during planning; implementation and publication remain future work.
- The adopted release tools have recorded immutable provenance and target only `dev/my-library` / `git.lan/dev/my-library`.
- Root `VERSION`, npm metadata, committed notes, and release configuration agree; local validation succeeds without credentials or external effects.
- The production image preserves application behavior, non-root startup, migrations, Chromium, storage, and health checks on the supported architectures.
- Local regressions and application checks pass, or any environmental blockers are reported explicitly without a publication-success claim.
- Root `tests/` preserves upstream project-root and fixture resolution; the documented unittest command discovers upstream and consumer suites. Template-only README assertions follow the consumer documentation contract instead, while version/notes invariants and publication safety regressions remain intact.
- Every local documentation path and fragment emitted by the release scripts resolves. Adopted documents have working transitive local links, application-specific examples, and pinned external references for upstream historical evidence; existing application verification guidance is preserved.
- Deployment docs distinguish immutable digest references from legacy version tags and preserve a usable default Compose deployment.
- No secrets are committed, HTTPS trust is not disabled, and no privileged host setup or destructive remote recovery is automated.
- Live publication is reported complete only after readiness gates and final Git, registry, release, and package-link verification pass; otherwise report the precise blocker.

## Risks And Decisions

- The reference has two acknowledged publication warnings. Adoption alone is not proof that a live production release is safe.
- Existing releases use the old helper's tag format and version image aliases. Preserve that history; the new workflow must not adopt or repair it as matching new-format evidence.
- The reference promotes `latest` before release creation, unlike the current helper. Document this partial-failure exposure accurately; never promise that every failure leaves `latest` unchanged.
- The reference does not run application checks or push `main`; both move into explicit pre-publication steps.
- Gitea package linking is package-wide, requires appropriate permissions and a narrowly supported server version, and needs operator-enforced exclusion of competing writers.
- Chromium and native Prisma artifacts can fail on cross-platform builds despite advertised builder support; actual builds and runtime checks establish separate evidence.
- `0.7.8` is provisional until remote inventories prove it unused. No network write, token provisioning, or release attempt is needed to create this plan.
