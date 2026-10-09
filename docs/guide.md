# My Library guide

A responsive personal book-management service for private and shared libraries. It supports Kyobo search/import, nested library folders, hierarchical genres, local cover and EPUB/PDF storage, reading history, backups, statistics, and a separate administrator realm.

## Languages

- Korean is the default interface language for new accounts, existing accounts after migration, and visitors without a saved preference.
- Signed-in users can select Korean or English in General Settings. The account preference applies to owned and shared libraries and is mirrored to a non-sensitive cookie so logged-out pages retain the last selected language.
- Routes do not include locale prefixes and the application does not infer English from the browser language.
- Interface text, expected feedback, accessibility labels, enum labels, and dates are localized. User-entered library/book data and Kyobo-provided titles, authors, descriptions, and genres are never translated or rewritten.

## Production deployment

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

## Local development

Use the development override to expose only PostgreSQL from Compose, then run Next.js on the host. Keep `SESSION_SECRET` and `ALLOWED_DEV_ORIGINS` in `.env`, and override the container-oriented database and cover paths for host commands:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm ci
npm run db:generate
export DATABASE_URL=postgresql://library:library@127.0.0.1:5432/library?schema=public
export COVER_STORAGE_PATH=./data/covers
export BOOK_FILE_STORAGE_PATH=./data/books
npm run db:migrate
npm run dev
```

Optional development data:

```bash
npm run db:seed
```

The development seed creates user `reader` with password `library-demo-password`. It exits without changes when `NODE_ENV=production`.

## Publish a release

The release command requires a clean `main` checkout whose `package.json` and `package-lock.json` contain the same unreleased semantic version. It runs the static checks, tests, and production build; pushes `main`; reserves the version with an annotated Git tag; builds and publishes `linux/amd64` and `linux/arm64`; creates the matching Forgejo release; and updates `latest` only after those immutable release records succeed. Restrict package-write access to release maintainers so the Git tag remains the serialization lock for semantic-version publication.

Create a Forgejo access token with repository-write and package-write permission, and store it outside the repository in a user-only file:

```bash
install -d -m 700 "$HOME/.config/forgejo"
umask 077
read -rsp "Forgejo token: " token
printf '%s' "$token" > "$HOME/.config/forgejo/forgejo-token"
unset token
stat -c '%a %n' "$HOME/.config/forgejo/forgejo-token"
```

The token file must have mode `600`. Do not put the token in this repository, `.env`, Compose, release arguments, or shell history. The release helper uses a temporary Docker configuration and removes its registry credentials on exit. Before publishing, run `npm run test:e2e` against a migrated disposable database and commit the intended package version. Then release with:

```bash
FORGEJO_TOKEN="$(<"$HOME/.config/forgejo/forgejo-token")" \
  ./scripts/release.sh
```

The workstation needs Docker Buildx with AMD64/ARM64 emulation. On a Linux Docker host, install binfmt support once and bootstrap the builder before the first cross-platform release:

```bash
docker run --privileged --rm tonistiigi/binfmt --install amd64,arm64
docker buildx inspect --bootstrap
```

The helper logs into `git.lan` as Forgejo user `dev`; set `FORGEJO_USER` when the token belongs to another account. It refuses positional arguments, dirty or non-`main` checkouts, malformed or inconsistent package versions, existing Git tags or Forgejo releases, and an existing immutable registry image. A failed release never moves `latest`; the reserved Git tag intentionally remains after a later failure to prevent another invocation from overwriting that version. Inspect and resolve any version image, tag, or release created before the failure rather than rerunning blindly.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests require a migrated test database. Live Kyobo access is not part of the normal test suite. Run the explicit diagnostic with:

```bash
npm run kyobo:probe -- 9791157107223
npm run kyobo:probe -- "너의 췌장을 먹고 싶어"
```

## Settings scope

- Display preferences belong to the signed-in user and apply when that user views any owned or shared library.
- Shelf tags belong to a library owner and are shared by all libraries that account owns. Editors can assign the owner's tags to books but cannot manage the owner's global tag collection.
- Library-specific settings retain their existing permissions: statistics are readable by library members, while sharing, ownership, transfer, and audit controls are owner-only.
- Library folders can contain books and more folders. Owners and editors can manage folders and move books; viewers can browse them. Folder covers may reference a book cover or use an uploaded JPEG, PNG, or WebP image in the existing protected cover volume.
- Version 3 library backups preserve folder trees, book assignments, book-derived folder covers, and uploaded folder covers. Version 1 and 2 backups remain importable with their books at library root. CSV preserves escaped folder paths but intentionally omits folder cover images.
- General Settings can export and import one versioned JSON backup containing every owned library plus account display preferences, language, shelf tags, and folder organization. Imports create new libraries without replacing existing collections; account backup files are limited to 50 MB, 100 libraries, 5,000 books, and 5,000 folders. EPUB/PDF binaries and attachment metadata are excluded from JSON and CSV, so restore them only with their matching database and `book_files` volume backup.

## Security boundaries

- User and administrator credentials and database sessions use separate tables and cookies. A user can never be promoted to administrator.
- Every library, book, cover, transfer, statistics, and audit request is authorized on the server.
- Folder hierarchy mutations validate library ownership, sibling uniqueness, and parent cycles; uploaded folder covers are served only to authorized library members.
- Kyobo book and genre URLs are canonical and validated. Covers are downloaded from an allowlisted HTTPS host, signature-checked, and served from protected local storage.
- Kyobo result pages show a bounded, display-only preview from the search response while canonical product metadata loads. Only the canonical product scrape is used when a book is added.
- EPUB and PDF files are size- and signature-checked, stored under generated keys, and downloadable only by authorized library members.
- Imports are bounded, validated, previewed, and applied transactionally. Credentials, memberships, sessions, and audit logs are never exported.
- Kyobo scraping uses an ordinary Chromium session because direct HTTP product requests return an empty CloudFront response in the target environment. It does not use stealth or access-control bypasses.
