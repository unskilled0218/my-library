# Image usage

- [Image usage](#image-usage)
  - [Authenticate and run](#authenticate-and-run)
  - [Platforms and immutable references](#platforms-and-immutable-references)

## Authenticate and run

My Library uses `git.lan/dev/my-library:latest`. Read [production deployment](production-deployment.md) for required secrets, PostgreSQL, migrations, persistent volumes, first-administrator setup, and backups. Publication through the new workflow remains subject to [readiness gates](publish-a-release.md#readiness-and-recovery); these instructions do not assert that a new release already exists.

For a private package, authenticate interactively with your authorized registry account. Registry login can persist credentials in Docker's configured store; never put token values in arguments or logs. The release tool uses its own private temporary authentication directory and does not log the caller in permanently.

```sh
docker login git.lan
docker compose pull
docker compose up -d
docker compose ps
```

Wait for health before accessing port 3000. Startup applies migrations and launches the standalone server as `node`; it does not install packages or browsers. The release workflow verifies the configured package's association with `dev/my-library`; association is package-wide and requires [writer exclusion and permissions](bash-publication.md#package-association). No live publication or Packages-tab verification follows from local tests.

## Platforms and immutable references

Docker selects AMD64 or ARM64 from the published index. Set `MY_LIBRARY_IMAGE` in `.env` to the full immutable reference `git.lan/dev/my-library@sha256:<verified-index-digest>`, using the digest from verified publication/tag evidence. Then run `docker compose pull` and `docker compose up -d`. Inspect a candidate index read-only with:

```sh
docker buildx imagetools inspect git.lan/dev/my-library:latest
```

`MY_LIBRARY_IMAGE` takes precedence over `MY_LIBRARY_VERSION`. Without a full-image override, Compose retains `git.lan/dev/my-library:${MY_LIBRARY_VERSION:-latest}` for compatibility. `MY_LIBRARY_VERSION` selects only legacy tags that already exist; the new workflow does not create `:v<version>` image aliases. Git `v<version>` tags instead bind the immutable index digest. `latest` is mutable and is promoted before release creation, so partial failure may already have changed it.

For runtime checks, use a disposable PostgreSQL database, distinct Compose project/volumes, isolated ports, and the verified digest. Test startup/migrations, health, book/cover storage across recreation, and an actual Chromium launch separately on each required architecture. Never target production data or infer runtime success from a manifest. See [platform preparation](platform-preparation.md), [verification](verification.md#release-workflow-checks), and [known limits](bash-publication.md#known-limits). There is no automatic retention, rollback, package reassignment, or local-image cleanup.
