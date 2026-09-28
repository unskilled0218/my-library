# My Library

A responsive personal book-management service for private and shared libraries. It supports Kyobo search/import, hierarchical genres, local cover storage, reading and lending history, backups, statistics, and a separate administrator realm.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and replace `SESSION_SECRET` with at least 32 random characters.
2. Optionally set both `ADMIN_ID` and `ADMIN_PASSWORD` to create the first administrator non-interactively.
3. Run `docker compose up`.
4. Open `http://localhost:3000`.

If no administrator environment credentials are present, the server prints a short-lived `/admin/setup?token=...` URL once the database is ready. The setup route closes permanently after the first administrator is created.

The application container needs Chromium and its Linux dependencies for Kyobo product pages. In a compatible Node image, install the browser with `npx playwright install chromium`. Use `npx playwright install-deps chromium` while building the image if its base OS does not already provide browser libraries.

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

## Security boundaries

- User and administrator credentials and database sessions use separate tables and cookies. A user can never be promoted to administrator.
- Every library, book, cover, transfer, statistics, and audit request is authorized on the server.
- Kyobo book and genre URLs are canonical and validated. Covers are downloaded from an allowlisted HTTPS host, signature-checked, and served from protected local storage.
- Imports are bounded, validated, previewed, and applied transactionally. Credentials, memberships, sessions, and audit logs are never exported.
- Kyobo scraping uses an ordinary Chromium session because direct HTTP product requests return an empty CloudFront response in the target environment. It does not use stealth or access-control bypasses.
