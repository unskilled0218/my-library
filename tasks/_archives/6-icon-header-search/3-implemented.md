# Implement common action icons

## Changes

- Added a dependency-free shared SVG icon module for search, camera, settings, filter, grid, list, save, delete, and close actions. Every icon uses `currentColor` and is hidden from assistive technology.
- Replaced visible action text with icons for the global search and scanner controls, global and library Settings links, library filter and view controls, Save and Delete actions, scanner close button, and Kyobo review modal close link.
- Preserved semantic buttons and links, localized accessible names, form actions, state attributes, responsive behavior, destructive colors, and the existing minimum 40px control target.
- Added contextual `Save {shelf}` and retained `Delete {shelf}` accessible names for shelf-tag actions.
- Expanded component and Playwright smoke assertions for icon-only rendering, decorative SVG behavior, localization, and existing interactions. Added focused `IsbnScanner` close-control coverage.
- Updated the application version from `0.4.0` to `0.4.1` in `package.json` and `package-lock.json`.

## Verification

- `npm test -- src/components/header-search.test.tsx src/components/library-search-controls.test.tsx src/components/library-book-list.test.tsx src/components/kyobo-review-modal.test.tsx src/components/isbn-scanner.test.tsx`: passed, 14 tests.
- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 51 tests in 18 files.
- `npm run build`: passed.
- `npm run test:e2e -- e2e/smoke.spec.ts`: blocked by the local environment. Port 3000 was occupied by an unhealthy existing server and the root-owned `.next/dev` lock prevented a fallback development server. A production-server retry on port 3001 also timed out because PostgreSQL was unavailable at `db:5432`.
- Manual browser verification was not possible because the application database was unavailable.
