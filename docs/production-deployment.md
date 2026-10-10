# Production deployment

Release images are published to the self-hosted Forgejo container registry at `git.lan/dev/my-library`. The image contains the standalone Next.js server, production dependencies, Prisma migrations, and Playwright Chromium for Kyobo product pages. Container startup applies pending migrations and then starts the server; it does not download packages or browsers.

The Docker host must trust the certificate authority that issued the `git.lan` certificate. Configure that trust in the host and Docker daemon rather than disabling TLS verification in this repository.

1. Run `docker login git.lan` when the package is private.
2. Copy `.env.example` to `.env` and replace `SESSION_SECRET` with at least 32 random characters. Single-quote literal secret values containing `$` so Compose does not interpolate them.
3. Optionally set `MY_LIBRARY_VERSION` to an immutable tag such as `v0.7.3`. It defaults to `latest` when omitted.
4. Optionally set both `ADMIN_ID` and `ADMIN_PASSWORD` to create the first administrator non-interactively. `ADMIN_PASSWORD` must be longer than 12 characters.
5. Run `docker compose pull` followed by `docker compose up -d`.
6. Wait for `docker compose ps` to report the app healthy, then open `http://localhost:3000` or request `http://localhost:3000/api/health`.

If no administrator environment credentials are present, inspect `docker compose logs app` for the short-lived `/admin/setup?token=...` URL after the database becomes ready. The setup route closes permanently after the first administrator is created.

PostgreSQL, downloaded covers, and uploaded EPUB/PDF files are held in the `postgres`, `covers`, and `book_files` named volumes. Back up PostgreSQL before an upgrade, retain the backup until the new image is verified, and include both file volumes in the deployment's volume backup and restore procedure. JSON and CSV exports intentionally exclude EPUB/PDF binaries, so they cannot replace a `book_files` volume backup. For example:

```bash
docker compose exec -T db pg_dump -U library -d library -Fc > my-library.dump
docker compose pull
docker compose up -d
```

Deployments upgraded from the old source-mounted Compose service may have a root-owned `covers` volume. After pulling the new image and before starting the non-root app, migrate that existing volume once using the image's built-in `node` account; this does not create a user:

```bash
docker compose run --rm --no-deps --user root \
  --entrypoint /bin/bash app \
  -c 'chown -R node:node /app/data/covers'
```

To roll back application code, set `MY_LIBRARY_VERSION` to the previous immutable tag and recreate the app with `docker compose up -d app`. Image rollback does not reverse database migrations; restore the matching PostgreSQL backup when a newer release changed the schema.
