# Implemented nested library folders

## Changes

- Added the recursive `LibraryFolder` data model, nullable book assignment, book-derived and custom folder-cover relations, sibling uniqueness constraints, traversal indexes, and a populated-database-safe Prisma migration. Existing books remain at library root.
- Added cycle-safe folder helpers for normalized titles, breadcrumbs, descendants, and flattened hierarchy options, with focused unit coverage for deep trees, ordering, cycles, and invalid roots.
- Added owner/editor folder creation, update, move, cover selection/upload, and empty-only deletion actions. Mutations validate same-library references, serialize hierarchy moves to prevent concurrent cycles, create bounded audit events, preserve filesystem/database consistency, and clean custom covers after replacement, deletion, or library deletion.
- Added protected custom folder-cover delivery with library read authorization, non-disclosing failures, strict storage-key validation, private caching, exact content metadata, and MIME-sniff protection.
- Updated the library browser with root and nested direct-content views, breadcrumbs, child-folder cards, item counts, cover states, folder-aware search/filter/pagination, localized management forms, hierarchy-safe parent choices, and responsive desktop/mobile layouts.
- Updated book details with a localized folder selector and backlink to the assigned folder. Folder changes are validated, transactional, audited, and revalidated without changing global search or statistics behavior.
- Added JSON backup version 3 for stable folder/book references, nested hierarchy, assignments, custom folder covers, and book-derived folder covers. Version 1 and 2 imports remain supported at root, account backups enforce aggregate limits, and CSV now round-trips escaped folder paths while omitting folder covers.
- Updated Korean and English library, book, settings, and transfer text; documented folder permissions and backup behavior; updated release examples; and bumped `package.json` and `package-lock.json` from `0.6.0` to `0.7.0`.
- Expanded action, cleanup, route, transfer-schema, and Playwright coverage. Browser fixtures now use authenticated imports instead of live Kyobo search, and Playwright runs one worker to avoid development Server Action manifest races across projects.

## Verification

- `npm run db:generate`: passed.
- `npx prisma validate`: passed.
- `DATABASE_URL=postgresql://library:library@127.0.0.1:5432/library?schema=public npm run db:migrate`: applied `20261002160000_library_folders` successfully; a second deploy reported no pending migrations.
- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 26 files and 95 tests.
- `npm run build`: passed with the folder-cover route in the production route manifest.
- `DATABASE_URL=postgresql://library:library@127.0.0.1:5432/library?schema=public COVER_STORAGE_PATH=/tmp/opencode/my-library-e2e-covers BOOK_FILE_STORAGE_PATH=/tmp/opencode/my-library-e2e-books ALLOWED_DEV_ORIGINS=127.0.0.1 npm run test:e2e`: passed, 8 desktop/mobile tests.
- After the final concurrent-move locking refinement, the focused nested-folder Playwright run passed in both desktop and mobile projects.
- `git diff --check`: passed.

## Result

- Library members can browse recursive folders while owners and editors can safely organize books, choose book covers or uploaded custom images, and delete only empty folders.
- Folder hierarchy and covers survive version 3 JSON backup round trips, legacy backups remain compatible, and CSV preserves folder paths without overstating cover support.
- Application version is `0.7.0`.
