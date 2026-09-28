# Implemented the my-library MVP

## Version

- Initialized the application release at `0.1.0`; the repository had no prior package or release convention.

## Application foundation

- Added a Next.js 16 App Router application with TypeScript, React 19, Tailwind CSS, responsive desktop/mobile layouts, metadata, loading/error/not-found states, linting, formatting, unit tests, Playwright configuration, and a production standalone build.
- Added PostgreSQL/Prisma configuration, an initial migration, database-only partial uniqueness constraints for root genres and open loans, development seed data, a readiness endpoint, environment validation, and Docker Compose services/volumes for PostgreSQL, dependencies, and persistent covers.
- Added setup and operational documentation in `README.md` and `.env.example`.

## Identity and authorization

- Added separate `User`, `Admin`, `UserSession`, and `AdminSession` models and cookies. Registered users have no administrator role or promotion path.
- Implemented registration, sign-in/sign-out, password hashing, generic credential errors, session expiry, account disabling, in-process authentication rate limiting, and transactional default-library creation.
- Implemented environment-based initial administrator bootstrap and a short-lived one-time setup-token route when environment credentials are absent. The setup token is invalidated and the route closes after the first administrator is created.
- Centralized owner/editor/viewer and administrator authorization and applied it to pages, mutations, protected covers, statistics, audit logs, and transfer endpoints.
- Implemented the required database-backed credential sessions directly rather than using Auth.js because Auth.js Credentials uses JWT sessions by design; the implemented layer preserves the plan's database-session and separate-principal requirements.

## Libraries and books

- Added library CRUD, descriptions, owner-only sharing management, viewer/editor permissions, location-tag add/rename/delete behavior, and persisted list/grid metadata visibility settings.
- Added paginated and responsive book list/grid views with text search plus reading, format, ownership, location, and genre-subtree filters.
- Added book detail/edit/delete flows with required canonical Kyobo source URLs, multiple authors, short descriptions, ISBNs, ownership/format/reading states, physical locations, comments, reading dates, and ratings.
- Added hierarchical shared genres with canonical Kyobo URLs, cycle/conflict protection, and many-to-many leaf associations so books preserve multiple complete Kyobo genre paths.
- Added physical-book lending, due-date editing, overdue visibility, return behavior, and retained loan history.

## Kyobo and covers

- Added a server-only Kyobo provider using the plain JSON autocomplete endpoint, exact first-result ISBN validation, bounded responses/timeouts, normalized candidates, and short-lived detail caching.
- Added Playwright product extraction for title, all linked contributors, ISBN, `#bookSimpleIntro`, cover URL, and every category breadcrumb path. Direct HTTP product requests remain empty in this environment, so no access-control bypass or brittle autocomplete-field inference is used.
- Added keyword/ISBN search, candidate review, mobile camera barcode scanning with a manual ISBN fallback, and a manual-entry fallback requiring canonical Kyobo book and genre URLs.
- Added server-side cover download with HTTPS host allowlisting, redirect/timeout/byte/dimension limits, file-signature checks, generated names, persistent storage, rollback/orphan cleanup, and access-controlled serving without Kyobo hotlinking for saved books.
- Added deterministic autocomplete/product parser tests and opt-in live ISBN/title probe commands.

## Portability, statistics, and audit

- Added owner-only versioned JSON backups with covers, books, genres, tags, settings, loans, ratings, and reading dates, plus spreadsheet-oriented CSV import/export without cover binaries or loan history.
- Added bounded schema validation, canonical URL and image validation, import preview, duplicate summaries, transactional apply behavior, genre/tag reconstruction, and cover cleanup after failed imports.
- Added authorized statistics for totals, reading state, format, genre, location, ratings, current loans, and overdue loans.
- Added immutable application-level audit creation for sharing, imports, library/book deletion, administrator setup, and user status changes, with owner and administrator views that omit credentials and book comments.
- Added a separate administrator dashboard for user search, account/library counts, account enable/disable behavior, session revocation, and system audit events.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed with no warnings.
- `npm run typecheck`: passed.
- `npm test`: passed 2 files and 5 deterministic tests.
- `DATABASE_URL=... npx prisma validate`: passed.
- `npm audit`: passed with 0 vulnerabilities after pinning patched Next.js, Prisma, Vitest, and image-size versions.
- `DATABASE_URL=... SESSION_SECRET=... COVER_STORAGE_PATH=... npm run build`: passed with Next.js 16.3.6; all application routes compiled as dynamic server routes.
- `npm run kyobo:probe -- 9791157107223`: passed with one exact result and complete Playwright metadata, including both genre paths and the cover URL.
- `npm run kyobo:probe -- "너의 췌장을 먹고 싶어"`: passed with four ordered results and the expected physical book first.

## Environment limitation

- Database migrations and Playwright application flows were not run end to end because this execution container has no Docker executable, PostgreSQL server, or PostgreSQL client. The migration, Docker Compose stack, and browser tests are included and documented; they require a reachable migrated PostgreSQL database.
