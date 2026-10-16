# Add nested folders to libraries

## Goal

Let library members browse books through folders nested to any practical depth, while owners and editors can create and manage folders, move books between folders and the library root, and give each folder a title plus an optional cover chosen from a library book or uploaded as a custom image.

## Confirmed scope and behavior

- Folders belong to one library and may contain direct child folders and direct books. A folder can be created inside the library root or the folder currently being viewed; nesting is recursive rather than limited to one level.
- Books may belong to at most one folder and existing books remain at the library root after migration. The root is not a persisted folder and continues to represent the library itself.
- Owners and editors can create, rename, move, change the cover of, and delete folders, and can move books through the existing book edit experience. Viewers can browse folders and books but see no mutation controls.
- Folder titles are required, trimmed, limited to 100 characters, and unique among sibling folders, including root-level siblings. The same title may be reused under different parents.
- A folder cover has exactly one of three states: no cover, a live reference to the current cover of a book in the same library, or an independently uploaded custom image. Selecting one source clears and cleans up the other source.
- A referenced book may be anywhere in the same library and must currently have a cover. If that book is deleted, its cover reference is cleared with `onDelete: SetNull`; moving the book does not invalidate the folder cover.
- Custom folder covers accept the existing JPEG, PNG, and WebP formats and existing 5 MB/dimension limits. They use generated storage keys and protected cover storage rather than filenames or database blobs.
- Deleting a folder is allowed only when it has no child folders and no books. This avoids implicit recursive deletion or surprising book moves; users must move its contents first.
- Moving a folder under itself or any descendant is rejected. All folder, parent, cover-book, and book-assignment mutations validate that every referenced record belongs to the same library.
- Folder browsing shows breadcrumbs, direct child-folder cards, and direct books. Existing search/filter/pagination controls apply to direct books in the current location; global search and statistics continue to cover every book regardless of folder.
- Existing library and account JSON backups gain folder structure, folder covers, and book assignments. Legacy backup versions remain importable with all books at root. CSV gains a folder path column but does not carry folder cover images.

## Data and storage design

- Add a self-referencing `LibraryFolder` model with ID, title, timestamps, `libraryId`, nullable `parentId`, nullable referenced `coverBookId`, and nullable custom cover key/MIME/dimensions. Relate it to `Library`, parent/children folders, direct `Book` records, and the optional cover-source `Book` through separately named relations.
- Add nullable `folderId` to `Book` with `onDelete: Restrict`, while the folder's book-cover relation uses `onDelete: SetNull`. Cascade folders when their owning library is deleted, but collect custom cover keys before the database cascade so filesystem cleanup still occurs.
- Enforce sibling-title uniqueness in the database for non-root children and with a PostgreSQL partial unique index for root folders, since ordinary nullable composite uniqueness does not prevent duplicate root titles. Add indexes for library roots, parent traversal, direct books, and cover-book references.
- Add a focused folder-tree helper that loads a library's folders, builds breadcrumbs and flattened select options, detects corrupt cycles defensively, and determines descendant IDs for move validation. Keep authorization in the existing library access boundary rather than creating folder-specific membership rules.
- Reuse `saveCoverData`, `readCover`, and `removeCover` for custom images, but expose uploaded folder covers only through an authenticated folder-cover endpoint that resolves the folder's library before reading the key. Referenced book covers continue to use the book cover presentation path.

## Implementation

1. Extend `prisma/schema.prisma` with `LibraryFolder`, the self-relations, library/book relations, folder-cover metadata, and `Book.folderId`. Add a migration that creates the table, foreign keys, partial root uniqueness, sibling uniqueness, and indexes while leaving every existing book at root; regenerate Prisma Client.
2. Add `src/lib/library-folders.ts` for bounded title normalization, hierarchy construction, breadcrumbs, flattened labels, same-library checks, cycle-safe descendant traversal, and cover-source validation. Bound traversal by the number of loaded folders so corrupt data cannot cause an infinite loop.
3. Add server actions for creating and updating folders. Require library `WRITE` access, validate parent and selected cover book in the same library, reject duplicate sibling titles and parent cycles, persist one cover mode only, write bounded audit events, revalidate affected library/folder pages, and redirect back to the resulting folder location.
4. For custom cover creation/replacement, validate the `File` through `saveCoverData` before the database mutation, remove the new file if persistence fails, and remove the superseded custom file only after success. Changing from a custom cover to a book cover or no cover follows the same post-commit cleanup rule.
5. Add a delete-folder action that locks or transactionally rechecks the folder, refuses non-empty folders, records `FOLDER_DELETED`, deletes metadata, and removes its custom image after commit. Extend `deleteLibraryAction` to collect all custom folder cover keys before cascading deletion and clean them alongside book covers and attachments.
6. Extend `updateBookAction` with a folder selector. Accept root as an empty value, validate a non-empty folder against the book's library, update `folderId` transactionally, record a bounded `BOOK_FOLDER_CHANGED` audit event only when the assignment changes, and revalidate the library root plus the old and new folder views.
7. Update `src/app/libraries/[id]/page.tsx` and `LibraryBookList` or extract a shared library-browser component so the `folder` query parameter selects a validated folder. Render localized breadcrumbs, child-folder cards before books, folder cover/no-cover states, create/manage controls according to access, and preserve the active folder in search, filters, view changes, and pagination links.
8. Add a folder editor component or forms with title, parent destination, cover mode, library-book cover picker, custom image input, clear-cover option, save, and delete controls. Exclude the current folder and all descendants from its parent choices, communicate the empty-folder deletion rule, provide image input constraints, and keep controls usable on mobile and by keyboard.
9. Add `src/app/api/folders/[id]/cover/route.ts` for custom folder images. Require an authenticated user with read access to the folder's library, return the same generic not-found result for missing and unauthorized resources, validate the stored key, and send trusted MIME, content length, `nosniff`, private caching, and inline image headers.
10. Update the book detail query and form to load the library's flattened folder choices and show the current folder. Add a breadcrumb/back link from a book to its containing folder, while leaving global search results and direct book URLs functional independently of folder navigation.
11. Add Korean and English messages in `src/lib/i18n/libraries.ts` and `src/lib/i18n/books.ts` for folders, breadcrumbs, root, title/parent/cover choices, create/save/delete/move actions, empty states, upload constraints, and validation feedback. Give cover images meaningful folder-title alt text and icon-only controls localized accessible names.
12. Introduce backup version 3 in `src/lib/transfer-schema.ts` with bounded folder records identified by backup-local keys, nullable parent keys, optional custom cover payloads, optional cover-book references through backup-local book keys, and each book's nullable folder key. Validate unique keys, existing references, same-library ownership, sibling names, acyclic parents, total folder limits, image payload limits, and the existing global size limits.
13. Update library and account transfer routes to export/import folders and assignments transactionally. Prepare custom cover files before the transaction with rollback cleanup, create folders in parent-before-child order, create books with stable import mappings, restore book-cover references after books exist, and clean every newly written cover on failure. Keep version 1 and 2 imports mapped to root books; add a `folderPath` CSV column with escaped path segments and create/resolve those paths during CSV import while omitting folder covers.
14. Ensure statistics and global/library-wide search remain unchanged semantically by not adding folder restrictions outside the library browser. Update seed data only if a small nested example materially improves development verification.
15. Update `README.md` with folder behavior, permissions, cover storage/backup implications, JSON version 3 compatibility, and CSV limitations. Bump the minor application version from `0.6.0` to `0.7.0` in `package.json` and `package-lock.json` for the new library organization capability.

## Testing and verification

- Unit-test folder-tree helpers for roots, deep breadcrumbs, flattened labels, duplicate sibling titles, missing parents, cycle detection, descendant calculation, and same-library parent/cover validation.
- Action-test owner/editor/viewer/unrelated-user permissions; root and nested creation; rename and move; self/descendant move rejection; duplicate names; book assignment/root removal; non-empty deletion rejection; and audit/revalidation behavior.
- Test custom cover upload, replacement, clearing, switching between custom and book sources, invalid type/signature/size, database-failure rollback, old-file cleanup after commit, referenced-book deletion, folder deletion, and library deletion cleanup.
- Route-test custom folder cover delivery for owners, editors, viewers, anonymous users, unrelated users, missing metadata/files, invalid keys, and exact security/cache/content headers without exposing filesystem paths.
- Component-test Korean and English root/folder views, breadcrumbs, nested cards, referenced/custom/no-cover rendering, direct-book filtering, empty states, hierarchy selectors, permission-based controls, accessible names, and mobile layout.
- Extend transfer tests for version 3 library/account round trips with deep folders, root books, custom and book-derived covers, old version 1/2 imports, invalid/cyclic references, folder count and payload bounds, transaction rollback cleanup, and CSV folder paths without cover data.
- Extend Playwright coverage to create nested folders, choose a book cover, upload and replace a custom cover, browse breadcrumbs, move a book into and out of a folder, verify filtered direct contents, reject deletion while non-empty, delete after emptying, and verify viewer read-only behavior where the sharing flow permits.
- Run the migration against empty and populated databases, verify existing books stay at root, and confirm database constraints reject duplicate siblings and cross-library-invalid relations where enforceable.
- Run `npm run db:generate`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`.

## Acceptance criteria

- Authorized users can browse an arbitrarily nested folder hierarchy, with breadcrumbs and only the direct child folders/books shown at each level, while existing books start and remain accessible at library root.
- Owners and editors can create, rename, move, cover, and delete empty folders and can assign books to any folder in the same library; viewers cannot mutate folder state.
- Parent cycles, duplicate sibling titles, cross-library references, and deletion of non-empty folders are rejected without partial mutations.
- Each folder reliably displays no cover, a referenced library book's current cover, or one validated custom image, and file replacement/deletion/library cleanup does not leak orphaned custom images across normal success and failure paths.
- Library/global search and statistics still include books regardless of folder, while library-browser filters and pagination retain the active folder and operate on its direct books.
- Version 3 JSON account/library backups round-trip folder hierarchy, assignments, and supported covers; versions 1 and 2 remain importable at root, and CSV round-trips folder paths without claiming to preserve folder covers.
- Korean and English interfaces, desktop/mobile layouts, authorization boundaries, migration, static checks, automated tests, production build, and version `0.7.0` pass.

## Out of scope

- Do not add drag-and-drop organization, bulk book moves, folder sharing independent of a library, per-folder permissions, public folder links, arbitrary file attachments to folders, folder-level display settings, or recursive destructive deletion.
- Do not duplicate a referenced book's cover into a new file, automatically choose folder covers, include child-folder books in the current folder's direct filtered list, or change global search/statistics to require folder selection.
