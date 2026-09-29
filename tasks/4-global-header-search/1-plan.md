# Add global header search

## Goal

Add a signed-in global search form between `MY / LIBRARY` and the account controls. Users can search Kyobo, every library they may read, or both sources from one results page, select a writable destination before adding a Kyobo book, and scan an ISBN from a mobile-only camera control.

## Confirmed decisions

- `Library` means books in every owned or shared library the signed-in user has read access to; the repeated Kyobo wording in the request was a typo.
- A selected Kyobo result requires a destination-library selector containing owned libraries and editor memberships, never viewer-only libraries.
- Existing `/libraries/[id]/search` URLs redirect to global Kyobo search and pass that library as a destination hint only after write access is verified.
- The existing detailed search/filter form on each library page remains available for searching within one collection.
- Remove the visible `Add from Kyobo` button from library headers, not the Kyobo add capability.

## Search contract and data access

1. Add an authenticated `/search` route using GET parameters `q`, `source`, `selected`, and optional `libraryId`. Allow only `all`, `kyobo`, and `library` source values, default missing/invalid values to `all`, trim the query, cap it at the provider's existing 120-character limit, and render an empty prompt rather than querying either source when `q` is blank.
2. Extract an access-constrained server helper in `src/lib/library-search.ts` for global library results. Query books only when their library is owned by the current user or has a membership for that user; include the containing library, cover/location/genre data needed by results; search title, description, comments, ISBN-10, ISBN-13, genre names, and location names while preserving the current exact-array author behavior unless a safe substring implementation is introduced; cap the initial result count and expose a clear truncation message rather than loading unbounded books.
3. In `all` mode, run library and Kyobo searches concurrently and render separate `Your libraries` and `Kyobo` sections rather than attempting to merge unrelated rankings. `library` mode must never call Kyobo, and `kyobo` mode must not query book results.
4. Preserve source-specific outcomes: an unavailable Kyobo provider in `all` mode must not hide valid library results, Kyobo-only mode must show a useful provider error, and true zero-result states must remain distinct from upstream failures. Do not retain the current blanket conversion of every Kyobo error into an empty result list.
5. Render library matches with title, authors, cover, reading/format metadata, containing library name, and a direct authorized `/books/[id]` link. Do not disclose library names, books, comments, covers, or shelf data from inaccessible libraries.

## Header UI

6. Add a focused client component such as `src/components/header-search.tsx` and render it only for signed-in normal users. Use a GET form targeting `/search` with controls in the requested order: query input, source select (`All`, `Kyobo`, `Library`), and `Search` submit button; add stable IDs, explicit labels or accessible names, and preserve current query/source values while on the search page.
7. Restructure `src/app/layout.tsx` so signed-in desktop navigation is ordered brand, search, account name/settings/sign-out. Use a three-column layout with a width-constrained center search; on mobile keep brand/account controls usable on the first row and let search span a second full-width row without changing DOM order. Anonymous and administrator headers must not render the user search.
8. Add a camera button to the header search that is visible only below the `sm` breakpoint. Opening it displays an accessible scanner dialog/panel with video, status/error text, and explicit close/stop controls; the text input remains the manual fallback.

## ISBN scanner

9. Refactor `src/components/isbn-scanner.tsx` from route-relative navigation to a reusable callback API such as `onDetected(isbn)` and `onClose()`. Normalize scanned values, accept only 10-13 digits, prefer an environment-facing camera when supported, and guarantee scanner/video-track cleanup after successful detection, close, startup failure, unmount, and navigation.
10. When the header scanner detects an ISBN, close the scanner and navigate to `/search` with the normalized ISBN and the currently selected source. Do not drop the selected source or retain unrelated stale search parameters.

## Kyobo review and add flow

11. Move the current Kyobo candidate list, selected-product detail review, and manual fallback from the per-library search page into the global search page. Selecting a candidate must preserve `q`, `source`, and a valid destination hint while adding `selected=<saleId>`; scrape full product details only for the selected candidate, never for every result.
12. Query destination libraries independently from readable search scope: include libraries owned by the user and memberships with role `EDITOR`, order them predictably, and exclude viewer memberships. Show a required destination selector in both scraped Kyobo and manual-add forms; validate an optional `libraryId` hint against this list before preselecting it and show a clear disabled state if no writable library exists.
13. Reuse `addKyoboBookAction` and `addManualBookAction` so destination authorization remains enforced server-side even if a user forges `libraryId`. Preserve cover download, genre creation, audit logging, duplicate handling, and redirect to the chosen destination library; optionally extend duplicate checks to both normalized ISBN-10 and ISBN-13 without weakening current behavior.
14. Replace `src/app/libraries/[id]/search/page.tsx` with an authenticated write-access redirect to `/search?source=kyobo&libraryId=<id>`, preserving valid `q` and `selected` values. Remove the `Add from Kyobo` link from `src/app/libraries/[id]/page.tsx`; leave the library Settings link unchanged.

## Resilience and accessibility

15. Keep search submit-driven rather than querying Kyobo on every keystroke. Preserve existing provider timeout/body limits and add a short bounded cache or per-user throttling only if needed without caching authorization-sensitive library results.
16. Use semantic headings for grouped results, labels for the source and destination selects, status/error regions for provider and camera failures, keyboard-operable open/close controls, focus management for the scanner dialog, and decorative empty alt text only where adjacent text supplies the book title.
17. Add stable IDs for the header search form/input/source/submit/camera controls, scanner dialog, global search page and source sections, destination selector, and result containers. Ensure the complete header and result layouts work at desktop and Pixel 7 widths without horizontal overflow.

## Test plan

- Add component tests for the header form's control order, GET action/names, all three source options, retained values, mobile camera trigger state, ISBN callback navigation, and scanner close/cleanup behavior. Mock media/scanner APIs; never require a real camera.
- Add library-search tests covering owned, editor-shared, and viewer-shared readable books; exclusion of inaccessible libraries; ISBN-10/ISBN-13 and text matching; result limits; and no leakage of unauthorized library metadata.
- Add global search route/provider tests with a mocked Kyobo provider: `all` invokes both sources, `kyobo` skips the database book query, `library` never calls Kyobo, invalid sources default safely, and Kyobo failure does not suppress library results.
- Add destination/access tests proving owner/editor libraries are selectable, viewer-only libraries are excluded, destination hints are validated, and forged viewer/inaccessible IDs are still rejected by add actions.
- Add tests for legacy route redirects that preserve safe query values only after write authorization.
- Extend Playwright coverage to assert the signed-in desktop header order, source options, library-only results, absence of `Add from Kyobo`, and no search form in anonymous/admin headers. On the mobile project, assert the camera button is visible and its dialog opens/closes; on desktop, assert the camera button is hidden.
- Keep live Kyobo and camera hardware out of normal CI. Run formatting, linting, type checking, unit/component tests, the production build, and database-backed desktop/mobile Playwright tests when PostgreSQL is available.

## Acceptance criteria

- Signed-in users see query input, `All`/`Kyobo`/`Library` source selector, and Search button between the brand and account controls on desktop, with a usable two-row mobile header.
- `All` renders authorized library results and Kyobo results in separate groups; each single-source option invokes and displays only that source.
- Library search includes every owned/shared readable library and never exposes inaccessible data.
- Kyobo and manual additions require an owned/editor destination and retain server-side write authorization.
- The old library `Add from Kyobo` button is removed, and authorized legacy search URLs redirect to the global Kyobo workflow with a validated destination hint.
- A mobile-only camera button scans a normalized ISBN into global search and always releases camera resources; desktop does not show the camera button.
- Existing per-library detailed filters, book access controls, Kyobo parsing, cover handling, audit behavior, and settings navigation continue to work.
