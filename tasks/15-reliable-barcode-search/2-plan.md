# plan

- [scope](#scope)
- [Implementation Plan](#implementation-plan)
  - [1. Reproduce the website-versus-app mismatch](#1-reproduce-the-website-versus-app-mismatch)
  - [2. Normalize ISBN requests and preserve matching identities](#2-normalize-isbn-requests-and-preserve-matching-identities)
  - [3. Add a bounded full-search fallback for missing ISBN matches](#3-add-a-bounded-full-search-fallback-for-missing-isbn-matches)
  - [4. Preserve result navigation and distinguish failures from no matches](#4-preserve-result-navigation-and-distinguish-failures-from-no-matches)
  - [5. Add transport, parser, and user-flow regressions](#5-add-transport-parser-and-user-flow-regressions)
  - [6. Verify the fix against fixtures and live Kyobo](#6-verify-the-fix-against-fixtures-and-live-kyobo)
- [Acceptance Criteria](#acceptance-criteria)
- [Risks And Decisions](#risks-and-decisions)

## scope

Fix missing Kyobo search results for an already-scanned ISBN when Kyobo's own website finds matching books. Concentrate on the search transport, response parsing, ISBN matching, and search-result rendering. Barcode decoding, camera behavior, library authorization, and the add-time canonical metadata/options flow are outside this task's scope. Preserve the public `searchKyobo(keyword): Promise<BookCandidate[]>` contract. No database migration or new dependency is expected.

## Implementation Plan

### 1. Reproduce the website-versus-app mismatch

- Obtain at least one ISBN that reproduces the user's report, or reproduce the mismatch with independently verified website results. Record the exact input, normalized query, website result title/product ID, and whether the app reports no matches or an upstream failure. A specific failing ISBN has not yet been supplied; do not claim a confirmed root cause from the current report alone.
- Compare the existing autocomplete request at `https://search.kyobobook.co.kr/srp/api/v1/search/autocomplete/shop?keyword=...` with Kyobo's full website search at `https://search.kyobobook.co.kr/search?keyword=...&gbCode=TOT&target=total`. Inspect the full-search result cards and, if necessary, their backing search response to identify the actual ISBN/product fields rather than guessing selectors or a private endpoint.
- Trace each stage in `src/lib/kyobo.ts`: upstream document count, candidates accepted by `mapDocument()`, candidates rejected for missing required identity fields, deduplication, and final ISBN filtering. Check whether the absence originates in autocomplete coverage, query formatting, a changed response shape, discarded identity fields, or ISBN-10/ISBN-13 representation.
- Extend `scripts/kyobo-probe.ts` with an explicit `--compare-search` mode that reports these search stages and website comparison without calling `getKyoboBook()`. Reuse the provider's request/parser helpers rather than building a second matching algorithm in the script. Keep any full-product diagnostic an explicit separate operation and document the comparison command in `docs/verification.md`.
- Preserve a small sanitized JSON/HTML reproduction fixture with the regression tests. Capture only fields/markup necessary to reproduce the search mismatch, not the entire website or account/session data.

### 2. Normalize ISBN requests and preserve matching identities

- In the Kyobo search boundary, normalize ISBN-shaped input before constructing either outbound request, using the existing hyphen/whitespace normalization. Ordinary title/author queries retain their meaningful text and current 120-character bound; do not strip punctuation from all search terms.
- Use a narrowly scoped ISBN identity helper shared by the search adapters and final matching step. Preserve exact matching for ISBN-13 and ISBN-10, including an ISBN-10 check digit `X` when encountered. Permit equivalence only for valid ISBN-10 and corresponding `978` ISBN-13 representations; do not convert a `979` ISBN-13 or match books by a shared prefix/title alone.
- Do not introduce a new checksum-based rejection policy for all existing user searches. Use checksum validation to establish safe cross-format equivalence, while retaining existing exact-match behavior for supported query shapes. Eleven- or twelve-digit numeric strings are not valid ISBN identities.
- Update `mapDocument()` only where observed responses justify it. Resolve identity fields from their actual documented-in-tests response locations, retain required title/product ID/ISBN validation, and keep absent or malformed optional metadata from discarding otherwise valid matches. Do not fabricate a result's ISBN from the search query to make filtering pass.
- Keep deduplication by Kyobo sale ID and preserve distinct editions/product IDs. If ISBN-10 `X` support reaches preview serialization, update only the related validation in `src/lib/kyobo-preview.ts` and its tests so a valid result can still open a preview; do not change the camera scanner or unrelated manual/import validation.

### 3. Add a bounded full-search fallback for missing ISBN matches

- Keep autocomplete as the current fast path. For ISBN-shaped queries only, consult Kyobo's full-search source when autocomplete returns no matching candidates, returns only rejected/nonmatching candidates, or fails with a transport/schema error. A successful exact/equivalent autocomplete match must not trigger a second request. Preserve ordinary keyword-search behavior.
- Implement the full-search adapter in `src/lib/kyobo.ts`, beside the existing search parser. Prefer the server-rendered public search response already observed during inspection; use a backing response instead only if the reproduction proves it is necessary. Isolate its parsing in a pure helper with captured fixtures so markup/schema changes have a small, testable boundary.
- Read only actual product-result records, not recommendation carousels, navigation links, advertisements, or unrelated page text. Map required product ID, title, ISBN, source URL, and format into `BookCandidate`; add author, cover, and supported preview metadata only when present and validated. Retain canonical Kyobo product URL generation and allowed cover-host checks.
- Return only exact or safely equivalent ISBN matches from the fallback and deduplicate its results by sale ID. Do not broaden a failed ISBN lookup into unrelated keyword recommendations or silently select a different edition. Do not fetch individual product pages to discover candidate identities.
- Distinguish a recognized valid empty result from malformed JSON, unexpected HTML, challenge/error pages, or a positive result count whose required product data cannot be parsed. A parser mismatch is an upstream failure, not proof that the book does not exist.
- Bound requests to the known Kyobo search host, encode parameters with `URLSearchParams`, and apply explicit timeouts and response-size limits. Retain the existing eight-second per-request timeout and two-megabyte response budget unless captured full-search evidence requires a documented adjustment. Perform at most one autocomplete request and one fallback request per ISBN search; do not add recursive retries, unbounded pagination, a browser pool, or a new search cache.
- If fallback succeeds, return its validated matches even when autocomplete failed. If it confirms a valid no-match result, return an empty array. If no usable source establishes the outcome, throw a contextual search error instead of returning an empty array. Keep full canonical metadata retrieval exclusively in the existing add action.

### 4. Preserve result navigation and distinguish failures from no matches

- Keep `/search` source behavior: `kyobo` searches Kyobo, `all` also searches the user's readable libraries, and `library` never makes a Kyobo request. Preserve signed-out Kyobo search and existing owner/editor destination selection.
- Keep the current distinction in `src/app/search/page.tsx` between `kyoboUnavailable` and a successful empty result (`noKyoboBooks`). Add contextual server-side diagnostics for unexpected provider/parser failures before returning the localized unavailable state; do not expose raw transport bodies or exceptions in the UI.
- Ensure fallback candidates use the existing `buildKyoboDetailHref()` path, carry bounded preview/search context, and open `/search/kyobo/[saleId]`. Opening the review must still avoid `getKyoboBook()`; adding the result must still fetch canonical metadata and accept the existing book options.
- Keep Korean/English labels and existing search metadata rendering. Add translation keys only if a new user-visible state is actually needed. Do not redesign the header, scanner, result cards, or manual-entry fallback to conceal the search failure.

### 5. Add transport, parser, and user-flow regressions

- Extend `src/lib/kyobo.test.ts` with the captured mismatch and pure full-search parsing cases: valid cards, multiple matching product IDs, duplicate cards, unrelated recommendations, optional metadata gaps, explicit zero results, changed/malformed required fields, and challenge/error markup. Verify that broken parsing cannot masquerade as a successful no-match response.
- Add request-level `searchKyobo()` tests with mocked fetch responses, rather than only fabricated final candidate arrays. Cover normalized ISBN parameters, working autocomplete without fallback, autocomplete empty/rejected/nonmatching results followed by a full-search match, autocomplete failure followed by successful fallback, confirmed no match, fallback failure, malformed response, timeout, and oversized bodies. Assert returned book identities and the maximum number of outbound attempts.
- Test exact ISBN-13/ISBN-10 matching, formatted queries, a valid `978` equivalence pair, an ISBN-10 ending in `X`, nonconvertible `979` ISBNs, and unrelated editions that must remain excluded. Retain existing rich-preview, product-parser, and deferred-add fixture tests.
- Add `src/app/search/page.test.tsx` using existing async server-page patterns. Verify a fallback result renders the expected preview link, successful empty results show the no-match message, unresolved upstream errors show the unavailable alert, and library-only search never calls Kyobo. Cover one signed-out and one signed-in combined-search case without weakening readable-library query checks.
- Add a focused desktop/mobile browser regression that opens `/search` with an already-decoded ISBN and verifies the expected candidate, review URL, and bounded preview context. Configure the nonproduction upstream fixture to reproduce an autocomplete miss and full-search hit through the actual adapter orchestration, rather than bypassing `searchKyobo()` with a canned final result. Keep all ordinary tests offline and existing fixture IDs isolated from the new scenario.
- Do not use the camera scanner as the test entry point: the reported failure occurs after successful decoding. Keep the existing scanner test unchanged and preserve the full deferred-add regression suite as compatibility coverage.

### 6. Verify the fix against fixtures and live Kyobo

- Run targeted provider/ISBN/preview/search-page tests, then `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. Run Prettier only against changed files and `git diff --check`.
- Run `npm run test:e2e` with an explicit `PLAYWRIGHT_DATABASE_URL` targeting an isolated disposable migrated database. Keep the dedicated port-3100 server, disabled reuse, loopback origin, and `.next/e2e` output/storage configuration introduced by the previous task. Do not write browser-test data into `library_dev`.
- Run the new live comparison probe with fixtures disabled for the reported failing ISBN, a known working control, and a genuine no-match query. Confirm the app and website agree about the expected product IDs at the same time; record query, timestamp, adapter outcomes, and limitations. Do not use live network access as a CI test dependency or scrape product details merely to verify search.
- Record exact commands, regression evidence, verification outcomes, and any external-service/browser blockers in `4-implemented.md` during implementation. Report missing prerequisites rather than installing system packages. Preserve unrelated working-tree changes and do not modify `todo.md`.

## Acceptance Criteria

- A documented ISBN that the Kyobo website finds but the current app misses returns the corresponding validated Kyobo candidate after the fix. A working control remains working, and the reproduction identifies which search stage previously lost the match.
- ISBN queries reach Kyobo in normalized form. Exact and supported cross-format identities match without admitting unrelated books, and distinct valid editions remain separate results.
- An autocomplete miss or failure can recover through bounded full search. Working autocomplete does not incur fallback, and title/author keyword search retains its existing behavior.
- Recognized no-match responses remain distinct from network, challenge, malformed-response, and parser failures; unresolved failures show the localized unavailable state and retain useful server diagnostics.
- Returned candidates open the existing review with correct preview/search context and remain addable through the canonical metadata/options flow. Searching and opening the review do not fetch full product details.
- Scanner/camera behavior, authorization, localization, library-only search, and existing deferred-add behavior remain intact. Relevant automated checks pass, and live reproduction results or concrete external blockers are recorded.

## Risks And Decisions

- Confirmed current behavior: autocomplete is the only search source, outbound requests use only trimmed input, and final filtering compares ISBN strings exactly. These are investigation targets, not yet a proven explanation of the user's intermittent failure.
- Planning-time read-only checks for `9791157107223` returned the same product, `S000001750574`, from autocomplete and the full website. That control did not reproduce the reported failure. The full website response also contained a server-rendered result, supporting investigation of an HTTP/HTML fallback without adding Chromium to search.
- Prefer a narrow ISBN fallback over replacing all keyword search or inventing an undocumented provider integration. Confirm the actual full-search response fields during reproduction, and document any evidence-driven change to the planned adapter before broadening it.
- Optional preview metadata must not suppress a real match, but product identity must remain verifiable. A query echo, product URL alone, or similar title is not sufficient evidence that a result has the requested ISBN.
- Live Kyobo results, markup, availability, and access conditions can change. Minimized captured fixtures protect the adapter contract; explicit live checks establish that the reported website/app mismatch is actually resolved. Passing a synthetic fixture alone does not prove that external behavior.
- Keep the known deferred-metadata boundary and existing nonproduction fixture safeguards. This task does not remediate unrelated add-action diagnostics, alter global genre data, migrate stored ISBNs, or expand barcode decoding.
- This stage writes only this implementation plan. Do not modify implementation code, change the project version, or install dependencies while planning.
