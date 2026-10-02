# Add EPUB and PDF files to books

## Goal

Let library owners and editors attach at most one EPUB and one PDF to each book, replace or remove either file independently, and let every authorized library reader download the attachments. Store ebook binaries outside PostgreSQL in protected persistent storage, preserve authorization and cleanup guarantees, and keep the existing JSON/CSV backup formats bounded by excluding ebook binaries.

## Confirmed scope and behavior

- "Update epub, pdf to book" means uploading EPUB and PDF files to an existing book, not renaming the current `PHYSICAL`/`EBOOK` format choices or changing Kyobo format mapping.
- A book can have zero or one EPUB and zero or one PDF. Uploading the same type again replaces that type only; an EPUB and PDF can coexist.
- Owners and editors can upload, replace, and remove files because they already have book write access. Viewers, editors, and owners can download files through existing library read access. Anonymous and unauthorized requests must not reveal whether a file or book exists.
- Attachments are allowed regardless of the book's current `BookFormat`. Uploading a file does not silently change `PHYSICAL` to `EBOOK`, because a catalog entry may represent a physical copy while also retaining a digital file.
- Preserve the original filename for display and download, but store the binary under an application-generated opaque key. Never use a client filename as a filesystem path.
- Limit each upload to 100 MB, accept only `.epub` and `.pdf` for the matching slot, validate both declared metadata and file signatures, and always serve files as downloads with MIME sniffing disabled. EPUB validation must at least establish a ZIP signature and expected EPUB media type/name; PDF validation must establish the `%PDF-` signature. The files are never rendered or executed by the application.
- Ebook binaries and attachment metadata are excluded from library/account JSON and CSV exports and imports. Existing backup version 2 remains unchanged; documentation must state that ebook storage is backed up and restored separately from JSON metadata backups.
- Treat file upload, replacement, and removal as audited book mutations. Do not audit ordinary downloads, and do not place binary content or sensitive paths in audit summaries.

## Data and storage design

- Add `BookFileType` with `EPUB` and `PDF`, plus a `BookFile` model related to `Book` with generated ID, type, opaque storage key, original filename, trusted MIME type, byte size, and timestamps. Enforce one attachment per type with a unique `(bookId, type)` constraint and cascade metadata deletion with the book.
- Add a Prisma migration that creates the enum, table, foreign key, uniqueness constraint, and lookup indexes without changing existing books or `BookFormat` values.
- Add `BOOK_FILE_STORAGE_PATH` to validated environment configuration with a local default distinct from `COVER_STORAGE_PATH`. Use a dedicated production mount such as `/app/data/books` and a dedicated Compose named volume so ebook files are not mixed with covers or image-specific validation.
- Add a focused server-only storage module rather than extending `covers.ts`. It owns size/type/signature validation, safe original-name normalization, generated keys, exclusive writes, reads, and best-effort removal. Keys must have a strict generated format and be validated before joining with the configured root to prevent traversal.
- Write a replacement file before changing database metadata. Upsert the `BookFile` row in a transaction with its audit event, delete the newly written file if the transaction fails, and remove the replaced old binary only after the transaction succeeds. A cleanup failure must be logged without rolling back valid metadata to a missing old file.
- For explicit removal, delete metadata and write the audit event transactionally, then remove the old binary best-effort. Extend book and library deletion flows to collect every attachment key before cascading database deletion and remove both ebook files and covers afterward.

## Implementation

1. Extend `src/lib/env.ts`, `.env.example`, `Dockerfile`, and `docker-compose.yml` with the ebook storage path and persistent volume. Create the runtime directory with ownership assigned to the official Node image's existing `node` account; do not create a new image user or combine ebook storage with the cover volume.
2. Add the Prisma enum/model/relation and migration. Regenerate Prisma Client and keep the migration deployable through the existing container entrypoint.
3. Add `src/lib/book-files.ts` with explicit constants for the 100 MB limit and supported types. Validate a non-empty `File`, matching route type, extension, declared MIME when supplied, and magic bytes; normalize the display filename to a bounded basename, reject control characters, generate a UUID-based key with the trusted extension, and use exclusive filesystem creation.
4. Add an authorized route under `src/app/api/books/[id]/files/[type]/route.ts`. `GET` requires book read access and returns a generic 404 for missing/unauthorized records, streams or reads the validated key, and sets trusted `Content-Type`, safe `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, private caching, and an exact content length.
5. In the same route, implement multipart `POST` for owners/editors. Reject an oversized declared request before parsing when possible, require one `file` field, use the route type as the authoritative slot, return localized/status-code-compatible outcomes for invalid type, invalid signature, oversize, and storage failure, and apply the write/upsert/audit/cleanup sequence above. Keep upload handling out of Server Actions so the existing 12 MB Server Action limit does not conflict with the 100 MB attachment limit.
6. Implement authenticated removal through `DELETE` in the route or a narrowly scoped server action used by the book page. Require write access, record `BOOK_FILE_REMOVED` in the same transaction as metadata deletion, return a generic not-found response when unauthorized, and revalidate the book page after a successful mutation.
7. Add a small client attachment panel if needed for fetch-based replacement/removal, or use multipart forms and redirects when that yields simpler progressive enhancement. On `src/app/books/[id]/page.tsx`, show each available attachment's localized type, original filename, and human-readable size with a download action for every member; show separate EPUB/PDF upload-or-replace controls and remove controls only to owners/editors. Keep the existing metadata edit form and book format selector unchanged.
8. Add Korean and English messages in `src/lib/i18n/books.ts` for the files section, EPUB/PDF labels, upload, replace, remove, download, size/type errors, success feedback, and the 100 MB limit. Ensure file inputs and icon/text controls retain explicit accessible names and mutation feedback is announced or otherwise visible.
9. Update `deleteBookAction` and `deleteLibraryAction` in `src/app/actions.ts` to collect and remove attachment files in addition to cover files after successful database deletion. Ensure failed database deletion leaves binaries intact and missing files do not prevent deletion completion.
10. Leave `src/lib/transfer-schema.ts` and backup payload version 2 unchanged. Update transfer/settings explanatory text and `README.md` to state that EPUB/PDF binaries are intentionally absent from JSON/CSV backups and that production backup/restore must include both the database and the ebook named volume. Do not emit storage keys or attachment metadata that would restore broken links.
11. Update production deployment documentation with the new volume, storage ownership, backup, restore, upgrade, and rollback implications. Existing deployments create an empty ebook volume automatically; no ownership migration is needed unless operators prepopulate the path externally.
12. Bump the application minor version from `0.5.0` to `0.6.0` in `package.json` and `package-lock.json` because protected ebook attachment storage is a new user-facing capability and release artifact requirement.

## Testing and verification

- Unit-test the storage helper with valid minimal PDF and ZIP-signature EPUB data; empty, mismatched extension/type, spoofed signature, wrong route slot, oversize metadata/content, unsafe/control-character filenames, invalid storage keys, exclusive-write collision, read, and idempotent removal cases.
- Route-test unauthenticated, viewer, editor, owner, and unrelated-user behavior. Cover successful EPUB/PDF upload, independent coexistence, replacement preserving the other type, failed replacement retaining old metadata/file, authorized download headers/body/name, invalid and oversized upload responses, removal, and generic unauthorized/missing responses.
- Test audit creation for upload/replacement/removal without binary or path leakage, transaction failure cleanup of newly written files, and best-effort cleanup after successful metadata mutation.
- Extend action tests so deleting one book removes its cover and every attachment only after database success, and deleting a library cleans all covers/attachments without one missing file blocking the rest.
- Component-test the book page/panel in Korean and English for viewer download-only behavior, editor/owner mutation controls, one EPUB and one PDF slot, filenames/sizes, accessible labels, replacement feedback, and no unintended format-selector change.
- Extend Playwright smoke coverage to upload small generated EPUB and PDF fixtures to a book as an owner, download both and verify attachment headers/content, replace one without changing the other, remove one, verify viewer read-only access if an existing sharing flow supports it, and check mobile layout/overflow.
- Run Prisma generation and migration against an empty database and an existing populated database. Confirm old books render with empty attachment slots and the unique constraint rejects a second metadata row of the same type outside the replacement path.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.
- Build and run the production image with a disposable ebook volume. Verify the existing `node` user can upload/download/delete, files survive app-container recreation, no upload enters the image layer or cover volume, and database/book/library deletion removes the expected binaries.
- Export and re-import library and account JSON containing books with attachments. Confirm exports remain version 2, contain no ebook bytes, filenames, keys, or attachment metadata, imports create books without broken attachment records, and the documented volume backup remains the only binary backup path.

## Acceptance criteria

- Every book supports at most one EPUB and one PDF attachment, and either type can be uploaded, replaced, downloaded, or removed independently without changing the book's `PHYSICAL`/`EBOOK` value.
- Owners/editors can mutate attachments, all authorized library members can download them, and anonymous or cross-library requests receive non-disclosing not-found responses.
- Only validated EPUB/PDF files up to 100 MB are stored under generated keys outside PostgreSQL; original names are display metadata only, downloads are forced attachments, and path traversal or MIME-sniff execution is prevented.
- Upload/replacement/removal maintains database/filesystem consistency across failures, creates bounded audit events, and book/library deletion cleans both attachment binaries and covers.
- Ebook files persist in a dedicated production volume owned by the existing image `node` account. The Docker image creates no additional user and performs no runtime package installation.
- JSON/CSV backup schemas remain version 2 and contain no ebook attachment data or broken storage references. README and UI backup guidance clearly require a separate ebook-volume backup for binary recovery.
- Version `0.6.0`, Prisma migrations, static checks, automated tests, production build, browser flow, and available production-container storage checks pass.

## Out of scope

- Do not add an in-browser EPUB/PDF reader, previews, text extraction, DRM handling, conversion between formats, remote/cloud object storage, public download links, resumable/chunked uploads, or multiple files of the same type.
- Do not infer or change a book's catalog format from its attachments, include ebook binaries in JSON/CSV exports, or migrate existing external ebook files into storage.
