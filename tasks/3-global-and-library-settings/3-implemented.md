# Implemented global and library settings

## Version

- Bumped the package version from `0.1.1` to `0.2.1` for the new settings routes, account behavior, data-model migration, and all-libraries backup follow-up.

## Changes

- Added account-level `UserDisplaySettings` and owner-level shelf tags, replacing per-library display settings and shelf-tag ownership.
- Added a data-preserving Prisma migration that selects each owner's earliest library display settings, creates defaults for every user, merges duplicate shelf-tag names by owner, and repoints books before removing obsolete records and columns.
- Added authenticated global Settings for immutable account identity, password changes, shared shelf-tag management, and display preferences that apply to every library viewed by the user.
- Added secure password-change validation with current-password verification, confirmation and policy checks, bcrypt rehashing, transactional session revocation, cookie clearing, rate limiting, and sign-in feedback.
- Replaced the signed-in header's `Libraries` button with `Settings`; the logo remains the route to the library list.
- Added role-aware library Settings with Statistics for readers and Sharing, Ownership, Import/export, and Audit log for owners. The main library page now contains one Settings entry point and no inline settings panels.
- Updated library filters and book editing to use the library owner's shared shelf tags while applying the current viewer's global display preference. Location mutations validate owner-tag scope for editors.
- Added back-navigation from statistics, audit, and transfer pages and preserved their existing server-side authorization.
- Added version-2 library backups that omit account-wide preferences, retained version-1 import compatibility, restored legacy unused shelf tags, and mapped all imported book locations to owner-level tags without overwriting display settings.
- Updated registration, seed data, documentation, stable IDs, responsive settings layouts, and accessible form labels/status messages.
- Added password validation, backup schema, migration-order, and compatibility tests, and extended the desktop/mobile browser flow for settings navigation, shared preferences/tags, and owner library settings.
- Added a General Settings account backup that exports every owned library with books, covers, genres, shelf assignments, global shelf tags, and display preferences, then previews and imports backups as new libraries without replacing existing data.
- Added a versioned account-backup schema with 50 MB, 100-library, 5,000-book, and 12-level genre-path limits; generated exports are validated against the same contract before download. Bulk imports are authenticated, rate-limited, transactionally applied, audited, and clean up newly written covers after failure.
- Changed both General Settings and library-specific Settings to single-column list layouts and added stable layout/import/export hooks for browser coverage.
- Prevented repeated import submissions while a preview or apply request is pending.

## Verification

- `npx prisma format`: passed.
- `npx prisma validate`: passed.
- `npm run format:check`: passed.
- `npm run lint`: passed with no warnings.
- `npm run typecheck`: passed.
- `npm test`: passed 7 files and 20 tests.
- `DATABASE_URL=... SESSION_SECRET=... COVER_STORAGE_PATH=... npm run build`: passed with Next.js 16.3.6 and both new settings routes.
- `npm run db:migrate`: could not connect to the configured PostgreSQL host `db:5432` (`P1001`), so the migration could not be deployed in this environment.
- `npm run test:e2e`: the Playwright web server could not start because pre-existing root-owned `.next/dev` files prevent lockfile acquisition by the non-root user. The expanded browser tests are included but could not execute here.
