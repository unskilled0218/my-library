# plan

- [scope](#scope)
- [Implementation Plan](#implementation-plan)
  - [1. Make the Kyobo detail route a lightweight add-book review](#1-make-the-kyobo-detail-route-a-lightweight-add-book-review)
  - [2. Show destination-specific book options before submission](#2-show-destination-specific-book-options-before-submission)
  - [3. Validate and save options with canonical metadata](#3-validate-and-save-options-with-canonical-metadata)
  - [4. Preserve feedback, navigation, and localization](#4-preserve-feedback-navigation-and-localization)
  - [5. Replace progressive-detail tests with add-time regressions](#5-replace-progressive-detail-tests-with-add-time-regressions)
  - [6. Run verification](#6-run-verification)
- [Acceptance Criteria](#acceptance-criteria)
- [Risks And Decisions](#risks-and-decisions)

## scope

Move full Kyobo product-detail retrieval from opening `/search/kyobo/[saleId]` to submitting its add-to-library form. Show destination-specific ownership, location, folder, reading state, reading dates, rating, and personal-comment options before saving. Keep the existing search-result preview, source link, writable-library access rules, canonical metadata storage, and successful return-to-search flow. No database migration or new dependency is required.

## Implementation Plan

### 1. Make the Kyobo detail route a lightweight add-book review

- In `src/app/search/kyobo/[saleId]/page.tsx`, remove the render-time `getKyoboBook()` call and the `resultPromise`, full-detail Suspense boundary, loading skeleton, canonical-versus-preview comparison, and detail-fetch retry behavior that depend on it. Remove obsolete local helpers and exports once their consumers and tests are updated.
- Continue validating `saleId` with `isKyoboSaleId()` and rejecting invalid paths with `notFound()`. Preserve `normalizeSearchQuery()`, `normalizeSearchSource()`, `parseKyoboPreview()`, and bounded preview handling from `src/lib/kyobo-preview.ts`.
- Render the existing preview title, authors, cover, ISBN, format, and search metadata without requesting the product page. Preserve the canonical outbound source link and back-to-results link with query, source, and authorized destination context.
- Support a direct valid detail URL without preview parameters: show a neutral localized message that full information will be retrieved when adding, the product link, and the add form when permitted. Do not perform a fallback scrape or require client-supplied title, authors, or ISBN to enable submission.
- Preserve signed-out sign-in guidance and the signed-in no-writable-library state. Opening or prefetching this route must never invoke `getKyoboBook()`, launch Chromium, download a cover, or mutate a book.

### 2. Show destination-specific book options before submission

- Add a focused client component, `src/components/kyobo-add-book-form.tsx`, for the interactive add form. Keep authentication, destination authorization, and database queries in the server page and action; pass only serializable display/options data into the component.
- Keep `writableLibraryDestinations()` as the owner-or-editor authority for selectable libraries. On the detail page, load location tags and folders only for those authorized destination IDs. Locations belong to each destination library's owner, matching `BookPage` and `updateBookAction`; an editor must see the owner's tags rather than the editor's personal tags.
- Pass per-library options with location IDs/names and flattened folder IDs/titles/depths, using `flattenedFolders()` from `src/lib/library-folders.ts`. Do not expand the shared search-results destination query merely to support this detail-page form.
- Render labeled controls for destination library, ownership (`HAVE`/`DONT_HAVE`), location, folder, reading state (`NOT_STARTED`/`READING`/`DONE`), start/finish dates, optional rating (1–5), and personal comment. Default to `HAVE`, no location, library root, `NOT_STARTED`, blank dates, no rating, and an empty comment.
- Display title and authors as preview text, without editable metadata inputs. Keep the final book format authoritative from Kyobo rather than introducing a format override. Hide or disable location when the preview clearly identifies an ebook; server validation must still use the canonical format.
- When the destination changes, rebuild location and folder choices and reset both selections to their empty defaults. Preserve non-destination-specific choices such as ownership and comment. Use explicit empty choices when the library has no tags or folders; do not add tag/folder creation to this form.
- Use a pending state to announce add-time metadata retrieval and disable repeated submission and destination changes until completion. Preserve option values after recoverable errors. Use React action state or an equivalent small client adapter while retaining a straightforward, testable server-action entry point.

### 3. Validate and save options with canonical metadata

- Update `addKyoboBookAction` in `src/app/actions.ts`: require a user, validate the product ID and submitted options, require `WRITE` access to the destination, and validate destination-bound IDs before invoking `getKyoboBook()`. Signed-out users, viewers, unrelated users, and invalid option submissions must not trigger the expensive fetch or a database write.
- Add a small typed parser in `src/lib/book-options.ts` for this add flow. Use the installed Zod dependency or explicit validation consistent with the project. Keep parsing separate from database ownership checks; do not refactor the existing manual-add or book-update actions as part of this task.
- Apply the stated defaults only to missing or blank optional fields. Reject nonempty unknown ownership/reading-state values, ratings outside integer 1–5, invalid calendar dates, and finish dates before start dates. Limit comments to 10,000 characters, matching the existing book editor. Return localized, actionable validation feedback.
- Verify a nonempty location ID belongs to the destination library's owner and a nonempty folder ID belongs to the destination library. Reject forged cross-owner tags and cross-library folders without scraping or writing. Recheck access and referenced records for every submission, regardless of options rendered earlier.
- Reuse `getKyoboBook(saleId)` as the sole source of persisted title, authors, description, ISBN, source URL, format, cover, and genre paths. Do not trust preview metadata or hidden form values for those fields. Preserve existing product URL validation and Kyobo cache behavior.
- Apply reading-date behavior consistent with the editor: `NOT_STARTED` stores both dates as null; `READING` stores the supplied valid start date or the current date and a null finish date; `DONE` stores supplied valid dates or the current date. Validate the final derived date order, including combinations of supplied and defaulted dates. Clear location for canonical ebooks, even if the preview or submitted form suggested a physical book.
- Persist the selected ownership, location, folder, reading state/dates, rating, and comment in the existing book-creation transaction with canonical metadata and genre relations. Preserve the `BOOK_CREATED` audit event and cover cleanup after transactional failure. Since initial placement is part of creation, do not emit a misleading folder-move event.
- Keep duplicate detection scoped to the destination library using canonical ISBN and source URL. Store a 10-digit ISBN in `isbn10` and a 13-digit ISBN in `isbn13`, matching the schema and existing duplicate predicate. Do not overwrite the existing book's metadata or options when a duplicate is found.

### 4. Preserve feedback, navigation, and localization

- Use typed recoverable action results for invalid options, duplicate books, metadata-fetch failures, and failed saves. Localize result codes in the form rather than returning raw exceptions to users. Keep authentication redirects and framework redirect exceptions outside broad catch blocks.
- Show errors within the add form with an accessible alert and preserve entered choices for correction or retry. A duplicate is an unchanged existing book, not a successful add. Keep support for existing `status=already-exists` links as a display-only compatibility state, but new duplicate submissions may return an inline action result instead of redirecting away from the filled form.
- On metadata-fetch failure, do not create a partial book or save preview data as a fallback. Make retry explicit by submitting again after an error. Preserve the separate existing manual-entry fallback on the search page.
- On success, preserve the `/search` redirect with `q`, `source`, validated `libraryId`, and `status=added`, along with the existing success notice and destination link. Revalidate the destination library page and both list pages (`/` and `/libraries`) so their book counts can refresh.
- Update Korean and English strings in `src/lib/i18n/search.ts` for deferred retrieval, pending submission, options, and errors. Reuse labels from `booksMessages` and `commonMessages` for existing concepts; do not duplicate translation dictionaries. Replace misleading direct-link/loading copy that currently promises a fetch merely on opening the page.

### 5. Replace progressive-detail tests with add-time regressions

- Rewrite `src/app/search/kyobo/[saleId]/page.test.tsx` around preview-only rendering and the add-review page. Mock `getKyoboBook()` and assert zero calls on page opening with a preview, without a preview, signed out, or without writable destinations. Cover invalid product IDs, bounded search context, source/back links, Korean/English text, and authorized initial destination selection.
- Add `src/components/kyobo-add-book-form.test.tsx` using the existing jsdom/Testing Library patterns. Cover defaults, owner-specific locations, nested folder labels, destination-change resets, preservation of unrelated choices, empty option lists, ebook location behavior, pending feedback, disabled resubmission, inline failures, and retry without losing values.
- Add `src/lib/book-options.test.ts` for default and explicit values, unknown enums, invalid/noninteger ratings, invalid calendar dates, reading-state date normalization, defaulted-date ordering, and comment limits. Freeze time for date-default tests.
- Update the `addKyoboBookAction` tests in `src/app/actions.test.ts`, or extract them into a focused test file if mocks become unwieldy. Verify canonical metadata wins over forged previews, each option reaches the saved record, 10/13-digit ISBN placement, editor-owner location scoping, ebook location clearing, audit behavior, invalidations, and the existing successful search redirect.
- Cover denied authentication/access, invalid IDs/options, foreign location/folder selections, duplicates, scrape failure, and transaction failure. Assert invalid submissions do not call Kyobo or write, duplicate submissions do not update existing records, and failed transactions clean up downloaded covers. Tests must check failure outcomes rather than only mock invocation counts.
- Replace the obsolete progressive-detail browser scenario in `e2e/smoke.spec.ts` with a focused deferred-add regression using deterministic Kyobo fixtures. Extend the nonproduction fixture support in `src/lib/kyobo.ts` only as needed to make a product-detail failure distinguishable from successful search preview loading; do not expose a production debug endpoint.
- Browser scenarios must prove opening a preview remains usable without a product-detail fetch, failed add-time retrieval leaves no saved book, retry retains options, and a successful add persists canonical contributors/genres and chosen options visible on the saved book page. Keep existing read-only title/author behavior on that page.
- Add a separate destination-switch browser scenario with two libraries and different location/folder choices. Verify stale selections clear and the saved book uses the selected library's valid options. Run these scenarios on desktop and mobile, include one English option/error path, and assert no horizontal overflow. Keep registration/setup helpers small rather than extending the existing broad registration scenario.

### 6. Run verification

- Run targeted Vitest tests for the detail page, add form, option parser, and action changes, then `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- Run Prettier checks only for changed files and `git diff --check`. Preserve unrelated working-tree changes and do not modify `todo.md`.
- Run `npm run test:e2e` against an isolated disposable PostgreSQL database with applied migrations and deterministic Kyobo fixtures. Do not use the seeded `library_dev` database as the browser-test database. Follow `docs/local-development.md` and `docs/verification.md` for setup.
- Chromium is needed both by browser tests and by real add-time Kyobo retrieval. Check availability and report missing browser/system dependencies or services instead of installing system packages. Record exact verification outcomes and blockers in `4-implemented.md` when implementing.

## Acceptance Criteria

- Opening or prefetching a valid Kyobo detail URL renders a preview or neutral direct-link review without calling the full metadata resolver or launching Chromium.
- A permitted user can choose ownership, destination-specific location/folder, reading state/dates, rating, and comment before adding. Defaults match existing saved-book defaults, and changing libraries cannot retain an invalid location/folder selection.
- Full canonical metadata is resolved when the add form is submitted and saved together with the validated options. Preview title/authors and submitted metadata cannot overwrite canonical values, and saved title/authors remain uneditable.
- Locations use the destination owner's tags, including for editor memberships; foreign IDs and non-writable destinations are rejected. Canonical ebooks have no location tag.
- Both ISBN lengths are persisted in the correct fields, duplicates leave the existing book unchanged, and recoverable failures show localized feedback while retaining choices without creating a partial book.
- Successful creation preserves audit/cover behavior, returns to the search with its success notice, and invalidates the destination and both library-list pages.
- Signed-out, no-destination, preview-free direct-link, Korean/English, and desktop/mobile states remain usable. Relevant checks pass or concrete environment blockers are recorded.

## Risks And Decisions

- The request changes the previously intentional progressive-detail behavior. The new detail route is a preview/add review, not a full canonical detail viewer. Fetching from a React prefetch, effect, or background request would violate the intended defer-until-add behavior.
- Interpret “ownership, location, etc” as the existing personal/organizational fields on the book editor: ownership, location, folder, reading state/dates, rating, and comment. Format remains canonical Kyobo metadata; this task does not add a user format override or alter manual entry, imports, or existing book-edit policies.
- Direct links may lack a title, authors, ISBN, or format preview. Keep the add flow usable from the product ID alone, explain the deferred lookup, and let the authoritative add-time response determine metadata and ebook rules.
- A library editor uses the owner's location tags, not their own account's tags. UI filtering is convenience only; authorization and relationship validation remain server-side at submission time.
- Slow retrieval now affects submission rather than page opening. Pending feedback, disabled resubmission, retained inputs, and explicit retries are required. Keep the existing scraper timeout/cache policy rather than adding a background-job subsystem.
- Existing duplicate detection is not a database uniqueness guarantee for truly concurrent requests. This task preserves it and prevents ordinary repeat clicks; do not introduce an unplanned migration or claim cross-request deduplication guarantees.
- The current action already resolves canonical metadata when adding; the main behavior change is eliminating the opening-time lookup and attaching validated options to that same creation path. No scraped publisher/price fields absent from the current Book schema are added to persistence.
- This stage creates only this plan. Do not modify implementation code, change the version, or install verification dependencies while planning.
