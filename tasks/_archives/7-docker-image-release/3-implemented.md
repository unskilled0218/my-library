# Docker image release implementation

## Changes

- Added a whitelist-style `.dockerignore` that admits only package metadata, build configuration, Prisma files, application source, the optional public directory, and the container entrypoint. Git metadata, local dependencies and builds, environment files, tasks, tests, reports, runtime data, and other machine-local content cannot enter the Docker build context.
- Added a multi-stage `Dockerfile` based on `node:24-bookworm`. It installs locked build and production dependencies separately, generates Prisma Client, builds Next.js standalone output, installs Playwright Chromium and its Linux dependencies at image-build time, includes static output and database migrations, and exposes OCI source/version/revision labels.
- Used the official Node image's existing `node` account for the runtime image. No user or group is created. Application files and the cover directory are owned by that existing account, and the final image declares `USER node`.
- Added `docker-entrypoint.sh`, which applies pending Prisma migrations with strict error handling and then replaces itself with `node server.js`, leaving the standalone server as PID 1. Added image and Compose health checks against the existing database-aware `/api/health` endpoint.
- Moved the Prisma CLI from development dependencies to production dependencies so the immutable image can run `prisma migrate deploy` without installing packages at startup. Kept `tsx` and development seeding outside the production dependency set.
- Converted `docker-compose.yml` from the source-mounted development process to a production stack that pulls `git.lan/dev/my-library:${MY_LIBRARY_VERSION:-latest}`, persists covers and PostgreSQL in named volumes, waits for a healthy database, and restarts services unless stopped. Removed source, npm-module, and browser-cache mounts.
- Added `docker-compose.dev.yml`, which exposes PostgreSQL only on `127.0.0.1:5432` for a host-run development server without starting the registry application image.
- Added `scripts/release.sh`. It rejects arguments, missing tools/token, dirty or non-main checkouts, inconsistent semantic versions, existing tags/releases/packages, failed tests, missing Buildx, and incomplete multi-platform manifests. It keeps API and Docker credentials in temporary private files/directories and never disables TLS verification.
- Made release reservation atomic through Forgejo's tag-creation API. The remote annotated tag is acquired before image publication, so concurrent releases cannot both publish the same semantic version; a partial release intentionally keeps the tag as a visible lock. The helper then pushes `linux/amd64` and `linux/arm64`, verifies both platforms, creates the Forgejo release, and promotes `latest` by the verified immutable manifest digest as its final mutation.
- Expanded `README.md` and `.env.example` with production deployment, immutable tag selection, certificate trust, secret quoting, health checks, first-administrator setup, database backup, cover-volume ownership migration, upgrade/rollback limits, local PostgreSQL development, token storage, Buildx/binfmt prerequisites, and the exact release command.
- Bumped `package.json` and `package-lock.json` from `0.4.1` to `0.5.0` for the new deployment capability. The release helper derives `v0.5.0` directly from that package version.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 18 files and 51 tests.
- `npm run build`: passed with the normal local environment.
- `npm run build` with `.env` temporarily absent: passed, confirming the production build does not require or embed runtime secrets.
- `npm ls --omit=dev`: passed and lists both `prisma@6.12.0` and the application runtime dependencies in the production tree.
- `npm install --package-lock-only --ignore-scripts`: passed with no lockfile changes, no vulnerabilities, and matching package/lockfile version `0.5.0`.
- `bash -n docker-entrypoint.sh scripts/release.sh`: passed.
- Release-helper argument rejection returned status 2 and its usage message; invocation without Docker returned status 1 and the explicit missing-Docker diagnostic; a clean-tree invocation with a harmless Docker command stub rejected branch `7-docker-image-release` before any network or Docker operation.
- Both shell files have executable mode `755`; the generated standalone tree contains Playwright, Prisma Client, and the generated `.prisma` client.
- Prettier parsed both Compose YAML files successfully, `git diff --check` passed, secret scans found no committed credential value, and scans confirmed the image creates no user or group and declares only the existing `node` account.
- A focused read-only review of the Docker and release flow found no remaining commit-blocking correctness or security issue after adding fail-closed package lookup, temporary Docker credentials, loopback-only development PostgreSQL, digest-based final `latest` promotion, cover ownership migration, and atomic Forgejo tag reservation.

## Environment-limited verification

- Docker is not installed in this development container. The image build, image metadata/filesystem inspection, Compose configuration rendering, non-root runtime, migration-first startup, health transitions, Chromium launch, volume permissions/persistence, PID 1, and built-image E2E flow could not be run here. Install Docker with Buildx on the release workstation before publishing.
- No Forgejo repository/package write token was provided. The exact package-version lookup, atomic tag conflict, multi-platform push/inspection, Forgejo release creation, immutable image pull, and `latest` promotion were not performed against `git.lan`.
- `npm run test:e2e` was not run because Docker is unavailable to provide the disposable migrated PostgreSQL and built-image stack required by this task. The existing unit/component suite and production builds passed.
- `shellcheck` and an independent YAML parser are not installed in this container. Shell syntax passed with Bash, and both Compose files passed Prettier's YAML parser, but `docker compose config` remains part of the Docker-workstation verification.

## Release state

- No image, Git tag, Forgejo release, or `latest` manifest was created from this implementation environment.
- After this branch is reviewed and merged to a clean `main`, a maintainer with Docker Buildx, trusted `git.lan` certificates, and a Forgejo token can run the documented `./scripts/release.sh` command to publish `v0.5.0`.
