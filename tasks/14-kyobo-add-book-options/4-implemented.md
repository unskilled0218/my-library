# Implementation

- [Implementation](#implementation)
  - [Changes](#changes)
  - [Validation And Persistence](#validation-and-persistence)
  - [Regression Coverage](#regression-coverage)
  - [Verification Results](#verification-results)
  - [Browser Verification Blocker](#browser-verification-blocker)
  - [Decisions And Version](#decisions-and-version)

## Changes

- Created branch `14-kyobo-add-book-options` from `main` without reusing an existing branch.
- Converted `/search/kyobo/[saleId]` to a lightweight preview/add review. Removed its full-detail resolver, progressive Suspense UI, canonical comparison, and detail-fetch retry helper. Direct links without preview fields remain usable and explain the add-time lookup.
- Added `src/components/kyobo-add-book-form.tsx` with destination library, ownership, location, folder, reading state/dates, optional rating, and personal comment. Title and authors remain display-only preview metadata.
- The server page loads tags from each authorized destination's owner and folders from that library. The shared search-results destination query remains unchanged. Switching destinations clears location/folder selections while retaining independent choices.
- Added localized Korean/English pending, validation, and failure feedback. Submission freezes the form during retrieval. Controlled values and cancellation of automatic form reset preserve all selected options after recoverable results, including retries.
- Preserved signed-out guidance, no-writable-library handling, product/back links, legacy duplicate-link feedback, the manual-entry fallback, and the successful return-to-search notice.

## Validation And Persistence

- Added the pure `src/lib/book-options.ts` parser using existing Zod. It applies defaults and validates enums, integer ratings, real calendar dates, final date order, and the 10,000-character comment limit.
- `addKyoboBookAction` validates product/options, destination write access, owner-specific tags, and library-specific folders before invoking the canonical Kyobo resolver. Authentication redirects remain outside recoverable-error catches.
- Canonical Kyobo title, authors, description, ISBN, URL, format, cover, and genres override any supplied preview metadata. A canonical ebook clears its location tag. Ten-digit and thirteen-digit ISBNs now populate their corresponding schema fields.
- Saved options join the existing creation transaction and `BOOK_CREATED` audit event. Duplicates return an inline result without modifying the existing book. Metadata-fetch failures create no partial record, and transactional failures clean up downloaded covers.
- Successful creation invalidates the destination library, `/`, and `/libraries`, then preserves the existing search-context redirect and success notice.

## Regression Coverage

- Replaced progressive-detail unit tests with preview-only page tests for zero metadata-resolver calls, direct links, anonymous/no-destination states, destination filtering, owner tags/folders, localization, invalid IDs, and legacy duplicate feedback.
- Added form tests for defaults, nested folders, destination resets, retained independent choices, empty lists, ebook handling, pending controls, input retention across React action reset, retry payloads, and Korean validation feedback.
- Added parser tests for explicit/default options, whitespace blanks, file-valued fields, leap-day and invalid-date inputs, invalid ratings/enums, comment boundaries, reading-state normalization, and defaulted-date ordering with frozen time.
- Added focused action tests for canonical metadata and all selected options, editor/owner tag scoping, ISBN lengths, ebook clearing, unauthorized and malformed submissions before scraping, duplicates, retrieval failures, transactional cleanup, and best-effort cover handling. Updated existing add-action tests for inline recoverable results.
- Replaced the progressive browser scenario with add-time canonical-metadata persistence checks. Added separate English failure/retry and two-owner destination-switch scenarios with real persisted choices and responsive assertions.
- Extended only nonproduction fixture behavior: each deferred fixture product fails its first metadata request and succeeds afterward. Browser scenarios generate unique IDs across cases, projects, and retries. A unit regression verifies preview search does not consume that failure and different product IDs remain independent.

## Verification Results

- Targeted Vitest checks passed during development, including the regression that exposed and then verified the fix for React's automatic select reset after an inline error.
- Final `npm test`: Passed, 173 tests across 34 files.
- Final `npm run lint`: Passed.
- Final `npm run typecheck`: Passed.
- `npm run build`: Passed.
- Prettier checks for all changed files and `git diff --check`: Passed.
- Created isolated database `library_test_14` on the existing development PostgreSQL service and applied all six existing migrations. No application schema migration was added, and the seeded `library_dev` database was not used for browser tests.
- `npx --no-install playwright test --list` with `PLAYWRIGHT_DATABASE_URL` targeting `library_test_14`: Passed, discovering 22 cases across three files and both projects.
- `npm run test:e2e` with `PLAYWRIGHT_DATABASE_URL` targeting `library_test_14`: The dedicated server started successfully. All 22 cases failed at browser launch because Chromium is not installed; no browser scenario body or assertion ran. The database remains available for a rerun after installing the browser.

## Browser Verification Blocker

The missing executable is `/home/container/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`. Install Chromium with `npx playwright install chromium` using the environment's normal setup process, then rerun with `PLAYWRIGHT_DATABASE_URL` pointing to the migrated disposable database. No browser or system packages were installed during this task. Real live Kyobo scraping also requires Chromium; no live Kyobo request was attempted during verification.

Browser-level persistence, retry navigation, shared-library selections, and responsive layout remain unverified until that rerun succeeds. Test discovery and mocked/component tests are not substitutes for browser execution.

## Decisions And Version

- Addressed the plan-review warning in the test harness: Playwright now owns port 3100, refuses existing-server reuse, and requires an explicit disposable database URL. Its child process receives that URL and fixture settings rather than using the ordinary development connection.
- Test-server build output and uploaded files use `.next/e2e`, separating the test server from normal port-3000 development. Added the corresponding generated-type includes to `tsconfig.json` and documented the new invocation in `docs/verification.md`. Restored regenerated `next-env.d.ts` to its original contents before committing.
- Reading dates represent UTC calendar days, including defaults, so a supplied finish date equal to today's default start date is valid regardless of the current time. Existing book-update/manual-add behavior was not refactored.
- Format remains authoritative Kyobo metadata; there is no add-time format override. Existing saved title/author immutability remains intact. Concurrent duplicate prevention remains the pre-existing application check rather than a new database uniqueness guarantee.
- Updated `package.json` and both root-version entries in `package-lock.json` from `0.7.4` to `0.7.5`, following the project's patch-version convention. Added no dependency and performed no release publication.
- Left `.env`, `todo.md`, the task goal/plan/review, and unrelated implementation code unchanged.
