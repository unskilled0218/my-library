# Implemented library list controls

## Version

- Bumped the package version from `0.1.0` to `0.1.1` as a backward-compatible patch release.

## Changes

- Moved the create-library form directly below the `Your libraries` heading and added stable IDs for the form and library-card container.
- Extracted a client-side library search component with the search input, `Search`, and `Filter` in one row. The filter panel starts hidden, opens below the row, exposes `Hide filters`, preserves active query filters while hidden, and resets its disclosure state on navigation or refresh.
- Extracted a client-side book-list component whose accessible grid/list buttons update only local layout state. View changes no longer navigate, alter query parameters, refresh server data, or request scrolling; persisted display settings still select the initial view.
- Preserved server-side filtering and pagination while removing the obsolete `view` search parameter from the library page.
- Added stable control IDs, disclosure semantics, pressed states, labels, and a `data-view` hook for accessible behavior and deterministic browser assertions.
- Added component coverage for filter disclosure, populated values, remount reset, hidden active filters, initial views, local view switching, URL stability, and scroll stability.
- Extended the Playwright registration flow to cover form ordering, search-row control order, filter visibility/reset, and grid/list URL and scroll preservation.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed with no warnings.
- `npm run typecheck`: passed.
- `npm test`: passed 4 files and 10 tests.
- `DATABASE_URL=... SESSION_SECRET=... COVER_STORAGE_PATH=... npm run build`: passed with Next.js 16.3.6.
- `npm run test:e2e`: not run successfully because a pre-existing root-owned `.next/dev/lock` and generated `.next/dev` files prevent the non-root Playwright web server from starting. No elevated or destructive cleanup was attempted.
