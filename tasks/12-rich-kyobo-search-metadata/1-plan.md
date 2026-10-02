# Show rich Kyobo search metadata without repetition

## Goal

Use all understood user-facing metadata already returned by Kyobo's autocomplete search to make results and the immediate detail preview more informative, while avoiding duplicate result records and suppressing metadata that would otherwise be shown again unchanged after the canonical product page loads.

## Confirmed scope and behavior

- Continue making one bounded Kyobo autocomplete request per search. Do not scrape every result's product page, add client polling, or delay the result list on Chromium.
- Parse the stable, observed `TOT_RELATE_HTML_LIST` positions for coarse category, publisher, publication year and month, list price, sale price, discount percentage, reward points, rating, description, cover URL, and category code in addition to the existing ISBN, title, author, and format.
- Treat opaque search fields such as ranking score, internal document IDs, group codes, stock/unknown flags, and unexplained numeric slots as provider internals. Preserve neither display nor business semantics for fields whose meaning has not been verified.
- Validate and bound every parsed string and number. Invalid, negative, non-finite, implausible, or absent optional values are omitted independently rather than rejecting an otherwise useful result.
- Deduplicate repeated autocomplete documents by validated `saleId`, retaining the first valid occurrence. Preserve distinct physical/e-book editions and different sale IDs even when title or ISBN-like display data overlaps.
- Display available metadata without empty labels: category, publisher and publication date, price/discount/reward, rating, and a readable description. Keep title, author, ISBN, format, and cover behavior intact.
- Preserve the progressive detail route. Carry a bounded subset of the richer candidate snapshot to `/search/kyobo/[saleId]` under the existing untrusted preview boundary; URL data remains display-only and canonical persistence still comes exclusively from `getKyoboBook`.
- Keep preview URLs within a documented total character budget. Include compact scalar metadata in full and cap the search description to a useful preview length; do not place an unbounded Korean description into the query string.
- On the detail page, show each value once when preview and canonical metadata agree. After enrichment, add only metadata unavailable from search, such as full genre paths and add controls, plus explicit corrected canonical values when title, contributors, ISBN, format, description, or cover-relevant identity differs.
- A direct detail URL without preview metadata must still display the complete canonical identity, contributors, description, format, ISBN, and genre paths after loading.
- Keep signed-in destination rules, duplicate-book feedback, retry behavior, back/search context, source links, successful-add redirects, and forged-destination rejection unchanged.

## Data design

- Extend `BookCandidate` in `src/lib/kyobo.ts` with optional typed search metadata rather than mixing it into `KyoboBook`: `category`, `publisher`, a normalized publication year/month value, integer won prices, discount percentage, integer reward points, rating, category code, and bounded description.
- Replace the current `fields.find(...)` heuristics for cover and description with named positional parsing based on the observed payload layout. Keep the outer two-megabyte response limit and add per-field limits so one document cannot create an oversized UI or URL.
- Parse monetary values from decimal strings into non-negative integer won amounts only when exact enough for display. Parse percentages and ratings into bounded numbers; do not calculate missing prices or discounts.
- Extend `KyoboPreview` separately with the approved optional fields. Update serialization, parsing, form round trips, and duplicate redirects through the same bounded helper so arbitrary query/form values cannot bypass validation.
- Add a total preview-query budget after percent encoding. Drop optional fields in a deterministic order, beginning with description and then lower-priority commercial metadata, while always retaining the required title, ISBN, and format snapshot.
- Define one comparison/normalization rule for preview versus canonical strings so whitespace-only differences do not produce duplicate correction blocks. Arrays are compared after trimming empty contributors while preserving provider order.

## Implementation

1. Expand the Kyobo search parser in `src/lib/kyobo.ts` with named constants or a small positional decoder for the verified autocomplete fields. Normalize whitespace, bound description/category/publisher/code lengths, validate year/month ranges, safely parse prices/discount/reward/rating, and retain the current allowlisted cover behavior.
2. Deduplicate valid mapped candidates by `saleId` in `parseSearchResponse` before applying exact-ISBN behavior. Ensure malformed first documents cannot hide a later valid exact ISBN result and distinct physical/e-book sale IDs remain separate.
3. Update `src/lib/kyobo.test.ts` with realistic physical and e-book payloads covering all understood fields, missing optional values, malformed numerics, oversized descriptions, exact-ISBN selection, duplicate sale IDs, and same-title distinct editions.
4. Update Kyobo result cards in `src/app/search/page.tsx` to show the richer metadata in a responsive hierarchy: identity first; category/publisher/date next; then available price, discount, reward, and rating; followed by a bounded description. Avoid repeated title/category text and omit rows with no values.
5. Add paired Korean/English labels and compact value formatting in `src/lib/i18n/search.ts`. Format won amounts and decimals through locale-aware helpers or `Intl.NumberFormat`; keep provider text untranslated and do not append misleading units to absent data.
6. Extend `src/lib/kyobo-preview.ts` to serialize and parse the approved optional fields with strict bounds and a total encoded-query budget. Preserve the existing cover host, ISBN, format, sale-ID, author count, and context validation.
7. Update preview helper tests for rich Korean round trips, malformed and repeated values, numeric bounds, description truncation, encoded URL budget behavior, optional-field drop order, and FormData duplicate redirects.
8. Update the dedicated detail preview in `src/app/search/kyobo/[saleId]/page.tsx` to render available category, publisher/date, commercial metadata, rating, and description immediately. Keep the loading status below the preview and do not wait for the product scrape.
9. Refactor the loaded detail section to avoid repetition. If canonical title, authors, ISBN, format, or description matches the preview, do not render it again; always show full canonical genre paths and add/sign-in controls. When values differ, render a clearly labeled canonical correction once. With no preview, render all canonical fields as today.
10. Keep full genre paths canonical-only. A coarse search category such as `소설` may remain in the preview while `국내도서 > 소설 > 일본소설` appears after loading because the latter is an enrichment, but suppress an exact duplicate one-node path if encountered.
11. Update `addKyoboBookAction` tests to prove rich preview fields survive a duplicate redirect only after reparsing and cannot alter canonical title, authors, ISBN, format, description, cover, prices, or genres used for persistence.
12. Extend detail component tests for matching preview/canonical metadata, corrected values, direct URLs, partial search metadata, coarse-category versus full-path enrichment, and failure states that retain all available preview information.
13. Update deterministic Playwright coverage to assert rich metadata on the result card, immediate preview before delayed details, no duplicate title/author/ISBN/description after enrichment, full genres after enrichment, browser-back restoration, and no desktop or Pixel 7 overflow.
14. Update `README.md` only if the Kyobo search-flow description needs to state which metadata is preview-only versus canonical. Bump the patch version from `0.7.2` to `0.7.3` in `package.json` and `package-lock.json`; no schema or migration is required.

## Verification

- Unit-test every verified positional search field against captured representative payloads, including physical/e-book differences, missing values, malformed numbers, field bounds, duplicate sale IDs, and exact ISBN filtering.
- Unit-test preview serialization/parsing and total URL limits with Korean descriptions, hostile cover hosts, repeated parameters, oversized values, and duplicate-action FormData.
- Component-test result cards and progressive detail rendering in Korean and English, including omission of absent fields and unchanged canonical duplicates.
- Run deterministic desktop and Pixel 7 Playwright coverage without live Kyobo product scraping; verify result, preview, loading, enriched, correction, direct-link, failure, and browser-back states without overflow.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` when PostgreSQL is available.
- Use live autocomplete samples only as an explicit parser diagnostic. Do not make network availability or `npm run kyobo:probe` a normal test requirement.

## Acceptance criteria

- Kyobo result cards expose every validated, understood user-facing field available in the autocomplete response without launching product-page browsers.
- Repeated provider documents produce one result per sale ID, while genuinely distinct editions remain visible.
- Selecting a result immediately shows its richer bounded preview and then adds canonical genres, controls, and only changed or previously unavailable metadata.
- Unchanged title, contributors, ISBN, format, description, and category information are not displayed twice on the detail page.
- Missing or malformed optional search fields degrade cleanly, preview URLs stay within their budget, and URL-carried values never affect persisted book data.
- Direct URLs, provider failures, duplicate feedback, authorization, localization, responsive layout, and canonical import behavior remain correct at version `0.7.3`.

## Out of scope

- Do not scrape every search result, persist prices/ratings/publication metadata, infer semantics for unknown provider fields, merge different editions by title, translate provider content, add sorting/filtering by the new fields, or change the local book schema.
