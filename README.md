# My Library

A responsive personal book-management service for private and shared libraries. It supports Kyobo search/import, hierarchical genres, local cover storage, reading history, backups, statistics, and a separate administrator realm.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and replace `SESSION_SECRET` with at least 32 random characters.
2. Set `ALLOWED_DEV_ORIGINS` to the comma-separated hostnames used to access the development server, such as `dev.lan,localhost`.
3. Optionally set both `ADMIN_ID` and `ADMIN_PASSWORD` to create the first administrator non-interactively. `ADMIN_PASSWORD` must be longer than 12 characters.
4. Run `docker compose up`.
5. Open `http://localhost:3000`.

If no administrator environment credentials are present, the server prints a short-lived `/admin/setup?token=...` URL once the database is ready. The setup route closes permanently after the first administrator is created.

The Compose app service uses the official `node:24-bookworm` image. Startup installs Chromium and its Linux dependencies for Kyobo product pages, while a named volume preserves the downloaded browser between container recreations.

## Local development

Provide a PostgreSQL `DATABASE_URL`, `SESSION_SECRET`, and writable `COVER_STORAGE_PATH`, then run:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Optional development data:

```bash
npm run db:seed
```

The development seed creates user `reader` with password `library-demo-password`. It exits without changes when `NODE_ENV=production`.

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
- Version 2 library backups preserve book shelf assignments by name but do not contain account-wide display settings. Version 1 backups remain importable; their legacy display block is ignored.
- General Settings can export and import one versioned JSON backup containing every owned library plus account display preferences and shelf tags. Imports create new libraries without replacing existing collections; account backup files are limited to 50 MB, 100 libraries, and 5,000 books.

## Security boundaries

- User and administrator credentials and database sessions use separate tables and cookies. A user can never be promoted to administrator.
- Every library, book, cover, transfer, statistics, and audit request is authorized on the server.
- Kyobo book and genre URLs are canonical and validated. Covers are downloaded from an allowlisted HTTPS host, signature-checked, and served from protected local storage.
- Imports are bounded, validated, previewed, and applied transactionally. Credentials, memberships, sessions, and audit logs are never exported.
- Kyobo scraping uses an ordinary Chromium session because direct HTTP product requests return an empty CloudFront response in the target environment. It does not use stealth or access-control bypasses.
