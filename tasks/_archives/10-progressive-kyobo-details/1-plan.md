# Load Kyobo book details progressively

## Goal

When a user selects a Kyobo search result, open a dedicated book-review page that immediately shows the metadata already parsed from the search response, then progressively reveals the slower product-page metadata and add-to-library controls without blocking the initial navigation on the Playwright scrape.

## Confirmed scope and behavior

- Replace the selected-result modal on `/search` with a dedicated route at `/search/kyobo/[saleId]`. Clicking a Kyobo candidate navigates to that route rather than adding `selected` to the search page URL.
- The first streamed page state shows the selected result's existing title, authors, ISBN, format, and cover as soon as the route shell renders. It must not wait for `getKyoboBook`, which can spend up to 45 seconds loading the product page.
- Load the authoritative product-page result behind a React `Suspense` boundary. While it runs, show localized status text and a stable skeleton below the candidate summary; when it finishes, reveal the complete description, canonical contributor list, genre paths, destination selector, and add action.
- Treat candidate metadata passed from the search result as display-only and untrusted. Persistence, duplicate detection, cover download, genre creation, and auditing continue to use the authoritative `getKyoboBook(saleId)` result in `addKyoboBookAction`.
- Preserve the originating query, source, and validated writable-library hint in the result link, detail-page back link, add form, duplicate feedback, and successful-add redirect. Closing/back returns to the same search result set rather than a generic search page.
- Signed-out users may see both preview and loaded details but receive the existing sign-in action. Signed-in users receive only owned/editor destinations; viewer-only and inaccessible libraries remain unavailable and forged destination IDs remain rejected by the server action.
- If the detail scrape fails, keep the immediate preview visible and replace the loading state with a localized error plus a retry mechanism that causes a fresh server navigation. Do not expose a partially enabled add form when canonical metadata or genre paths are unavailable.
- Existing bookmarked `/search?...&selected=<saleId>` and authorized legacy `/libraries/[id]/search?...&selected=<saleId>` URLs should redirect to the dedicated route with safe search context. Direct detail URLs without a preview snapshot still render a useful shell and progressively load authoritative details.
- Remove the modal-only body scroll lock, focus trap behavior, Escape/backdrop dismissal, and selected-detail query work from the search-results page. Normal browser back navigation is the primary dismissal behavior on the dedicated page.

## Route and data design

- Add `src/app/search/kyobo/[saleId]/page.tsx` as a server-rendered page. Validate the route sale ID with the existing Kyobo ID pattern, normalize `q` and `source` with the existing search helpers, validate the optional destination against `writableLibraryDestinations`, and derive all Kyobo product URLs from the validated sale ID.
- Encode the lightweight candidate snapshot in bounded query parameters generated only by the result-link builder: title, repeated author values, normalized ISBN, format, and an optional allowlisted HTTPS cover URL. Add a focused parser/builder module that caps lengths/counts, rejects invalid ISBN/format/cover hosts, and produces a safe fallback when a direct or legacy URL has no snapshot.
- Keep URL-carried preview fields separate from the canonical `BookCandidate`/`KyoboBook` types so code cannot accidentally treat them as trusted provider data. React escaping handles text output, while cover rendering requires the existing `contents.kyobobook.co.kr` HTTPS host.
- Render the preview card in the route's synchronous shell. Place an async server component below it inside `Suspense`; that component calls `getKyoboBook`, catches provider failures into an explicit result state, and loads authentication/destinations concurrently instead of serializing independent work.
- Reuse the existing five-minute detail cache so the add action usually avoids another browser scrape after review, but preserve correctness when another process handles the action by allowing `addKyoboBookAction` to fetch canonical details again.

## Implementation

1. Add a small `src/lib/kyobo-preview.ts` module with types and helpers to serialize a `BookCandidate` into detail-route query parameters, parse and bound incoming preview values, validate sale IDs and cover URLs, and construct the back/search context. Unit-test malformed, repeated, oversized, and missing values as well as Korean text and multi-author round trips.
2. Refactor `src/app/search/page.tsx` to stop calling `getKyoboBook` and remove `detailResult` from its blocking `Promise.all`. Keep Kyobo search, authorized library search, destination lookup, manual fallback, provider errors, and add-success notice unchanged.
3. Change each Kyobo result link to `/search/kyobo/[saleId]` with the normalized search context, valid destination hint, and bounded preview snapshot. Preserve candidate result appearance and stable IDs so selecting a result is the only interaction that changes.
4. Add the dedicated detail page with a clear back link, candidate preview, source link, localized title, and responsive mobile/desktop layout. Validate unknown sale IDs with `notFound`; do not initiate another Kyobo search merely to reconstruct the preview.
5. Add an async detail section under `Suspense`. Render canonical authors, description, genre paths, ISBN/format corrections where they differ, and the existing owner/editor destination form only after `getKyoboBook` succeeds. Render the sign-in or no-writable-library state using the same access rules as the current modal.
6. Add a localized loading fallback with `role="status"`, `aria-live="polite"`, dimensions that prevent layout shift, and text explaining that additional Kyobo information is loading. Add a localized non-destructive failure panel with retry and back-to-results links while retaining the preview above it.
7. Update `addKyoboBookAction` duplicate handling so it returns to the dedicated detail route with `status=already-exists`, preserving normalized search/destination context and a safely re-parsed preview snapshot. Keep successful additions redirected to `/search` with the existing bottom notice and keep all authorization and canonical refetch behavior unchanged.
8. Update `src/app/libraries/[id]/search/page.tsx` and the global search compatibility path so legacy `selected` URLs redirect to `/search/kyobo/[saleId]` only after existing access and ID validation. Drop malformed selected values rather than reflecting them into a route.
9. Remove `KyoboReviewModal` and its tests once no route imports it. Do not retain unused modal state, body-scroll effects, focus management, or selected-query rendering code solely for backward compatibility.
10. Add Korean and English messages in `src/lib/i18n/search.ts` for back to results, preview metadata, loading additional details, loaded-detail headings, retry, direct-link fallback, and retained failure feedback. Preserve meaningful headings and accessible labels without announcing the same title repeatedly.
11. Update `addKyoboBookAction` tests for the new duplicate URL and preview normalization. Add route/component tests proving the preview renders before a deferred detail promise resolves, loaded details replace the status state, provider failure leaves the preview intact, anonymous and writable-destination states remain correct, and old selected URLs redirect safely.
12. Extend Playwright coverage with a mocked or deterministic Kyobo boundary: select a candidate, assert the dedicated URL and immediate preview, hold the detail response to observe the loading state, release it to observe description/genres/add controls, use browser back to restore results, and verify the page has no desktop or Pixel 7 overflow. Normal CI must not launch a live Kyobo browser scrape.
13. Update `README.md` only if its search-flow description needs to distinguish candidate previews from authoritative imported metadata. Bump the patch version from `0.7.0` to `0.7.1` in `package.json` and `package-lock.json` because this changes Kyobo review navigation and perceived performance without changing stored data or deployment requirements.

## Verification

- Unit-test preview URL serialization/parsing, sale-ID validation, cover-host rejection, repeated authors, bounds, missing direct-link data, and safe preservation of `q`, `source`, and `libraryId`.
- Test that `/search` never calls `getKyoboBook`, candidate links point to the dedicated route, provider search failure remains independent from library results, and legacy selected URLs redirect without open redirects or unbounded reflected values.
- Test the streamed detail states with a controllable deferred provider: immediate preview, loading announcement, successful canonical enrichment, failure/retry, anonymous sign-in, no writable destination, valid destination preselection, and duplicate feedback.
- Test `addKyoboBookAction` to confirm preview values cannot alter the persisted canonical title/authors/ISBN/genres/cover and forged destination IDs still fail authorization.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and deterministic desktop/mobile `npm run test:e2e`.
- Run `npm run kyobo:probe -- 9791157107223` only as an explicit external diagnostic when live Kyobo access and Playwright Chromium are available; do not make it a normal test prerequisite.

## Acceptance criteria

- Selecting a Kyobo result navigates to `/search/kyobo/[saleId]` and displays title, author, ISBN, format, and available cover before the slow product scrape finishes.
- A visible, accessible loading section is replaced by canonical description, contributors, genre paths, and add controls when enrichment succeeds, without replacing or blanking the whole page.
- Detail failure leaves the preview and navigation usable, offers retry, and never enables an add with incomplete canonical data.
- Search context, destination hint, duplicate feedback, successful-add notice, browser back behavior, signed-in/signed-out permissions, and owner/editor authorization remain correct.
- Search results no longer block on selected-book detail scraping, old selected links redirect safely, and no obsolete modal code remains.
- Preview URL data is bounded and display-only; all persisted book data still comes from the authoritative Kyobo product scrape.
- Korean and English experiences pass accessibility, responsive desktop/mobile, static, unit, build, and deterministic browser checks at version `0.7.1`.

## Out of scope

- Do not persist preview or scraped Kyobo details before the user adds a book, add client-side polling, introduce a job queue, pre-scrape every search result, cache authorization-sensitive destination lists, or change the existing local book detail page.
- Do not make URL preview metadata authoritative, relax Kyobo URL/cover allowlists, bypass Playwright product parsing, or add automatic retries that can launch multiple concurrent browsers for one page view.
