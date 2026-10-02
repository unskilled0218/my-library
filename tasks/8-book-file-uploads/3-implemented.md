# EPUB and PDF book file implementation

## Changes

- Added `BookFileType` (`EPUB`, `PDF`) and `BookFile` Prisma records with generated IDs, unique opaque storage keys, original names, trusted MIME types, byte sizes, timestamps, a cascading book relation, and a unique book/type constraint. Added the corresponding forward-only PostgreSQL migration without changing existing books or `BookFormat` values.
- Added `BOOK_FILE_STORAGE_PATH` with a local default, example production value, ignored local directory, Docker runtime directory, and a dedicated Compose `book_files` volume. The image continues to use the official Node image's existing `node` user and creates no user or group.
- Added `src/lib/book-files.ts` with a 100 MB per-file limit, route type parsing, EPUB/PDF extension and declared-MIME validation, PDF/ZIP magic-byte checks, bounded safe display names, UUID storage keys, exclusive writes, strict key validation, reads, and idempotent removal.
- Added authenticated `GET`, `POST`, and `DELETE` handlers at `/api/books/[id]/files/[type]`. Readers receive forced private downloads with trusted MIME, RFC 5987 filenames, exact lengths, and `nosniff`; owners/editors can upload, replace, and remove files; invalid types and unauthorized/missing resources return non-disclosing 404 responses.
- Serialized upload, replacement, removal, book deletion, and library deletion on PostgreSQL book-row locks. New bytes are removed after a failed metadata transaction, replaced bytes are removed only after commit, metadata deletion and bounded audit events are transactional, and cleanup failures do not invalidate successful database changes.
- Added `BookFilesPanel` to the book detail page. Every member sees independent EPUB/PDF names, sizes, and download links; owners/editors receive localized file pickers and upload/replace/remove controls with visible live status. Attachments do not alter the existing physical/ebook selector.
- Added Korean and English attachment labels, validation/status feedback, and backup warnings. Updated library/account transfer and settings guidance to state that JSON/CSV version 2 excludes EPUB/PDF binaries and attachment metadata.
- Updated book and library deletion to remove every attachment and cover only after successful database deletion, including uploads racing deletion. Updated README deployment, local development, backup/restore, feature, and security guidance for the separate ebook volume.
- Added storage helper, migration, authorized route, transaction cleanup, deletion cleanup, and localized component tests. Added a Playwright flow that creates a manual book, uploads EPUB/PDF, verifies a downloaded PDF, replaces PDF without changing EPUB, removes EPUB, and checks the remaining slot.
- Bumped `package.json` and `package-lock.json` from `0.5.0` to `0.6.0` for the new attachment capability.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 23 test files and 70 tests.
- Focused attachment suite: passed, 5 files and 19 tests.
- `npx prisma validate`: passed.
- `npm run db:generate`: passed with Prisma Client 6.12.0.
- `npm run build`: passed and includes `/api/books/[id]/files/[type]` as a dynamic route.
- Package and lockfile versions both resolve to `0.6.0`; `git diff --check` passed.
- Static inspection confirmed library/account transfer routes have no attachment relation, key, filename, metadata, or binary mapping, so backup version 2 remains unchanged and imports create no broken attachment references.

## Environment-limited verification

- `npm run db:migrate` could not connect to PostgreSQL because the configured Compose hostname `db:5432` is unavailable in this container (`P1001`). The migration SQL is covered by a focused structural test and Prisma schema validation, but empty/populated database deployment and live uniqueness/cascade checks were not run.
- `npm run test:e2e` was not run because its required migrated PostgreSQL service is unavailable. The new browser flow is checked by TypeScript, ESLint, and Prettier but awaits the Docker-backed test environment.
- Docker is not installed, so image build, Compose rendering/startup, existing-`node`-user write permissions, volume persistence across recreation, separation from covers/image layers, and container-level upload/download/deletion checks were not run.

## Notes

- The pre-existing uncommitted generated change in `next-env.d.ts` was not authored for this task and is intentionally excluded from the implementation commit.
- JSON/CSV remains metadata portability rather than ebook binary backup. A recoverable production backup must keep PostgreSQL and the matching `book_files` volume together.
