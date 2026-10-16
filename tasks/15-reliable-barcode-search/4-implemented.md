# Implementation

- [Implementation](#implementation)
  - [Reproduction And Decision](#reproduction-and-decision)
  - [Changes](#changes)
  - [Regression Coverage](#regression-coverage)
  - [Verification Results](#verification-results)
  - [Live Verification](#live-verification)
  - [Scope And Version](#scope-and-version)

## Reproduction And Decision

Selected path B after live reproduction on 2026-10-16. Before changing production search behavior, direct HTTP comparisons showed that autocomplete returns `totalSize: 0` and an empty `resultDocuments` array for `9780132350884`, while the full website search returns `Clean Code`, product `S000006148336`, with `data-bid="9780132350884"` on its actual result card. With no upstream documents, normalization or response-field corrections cannot recover this match from autocomplete.

The same mismatch occurred for `9780134494166` (`Clean Architecture`, `S000006174058`), `9780201633610` (`Design Patterns`, `S000006436806`), `9780201835953` (`The Mythical Man-Month`, `S000006439403`), `9780134757599` (`Refactoring`, `S000006177268`), `9780596007126` (`Head First Design Patterns`, `S000010480296`), `9788936434267` (`아몬드`, `S000000610625`), and `9788983921987` (`해리포터와 혼혈왕자 제6권 3`, `S000001296451`). The control `9788937460449` returned `데미안`, `S000000620181`, through autocomplete. These are independently reproduced failures, not an assumption about the user's unspecified ISBN.

The website's server-rendered `.prod_item` cards expose product identity through `data-pid`, `data-bid`, and `data-name` attributes, including a canonical product link. This supports an HTTP-only full-search fallback without fetching product detail pages or launching Chromium during search.

## Changes

- Created branch `15-reliable-barcode-search` from `main` without reusing an existing branch.
- Preserved the autocomplete fast path and public `searchKyobo(keyword)` candidate-array contract. ISBN-shaped queries now use the full public website search only after autocomplete returns no matching identity or fails. Working autocomplete and ordinary title/author queries retain a single-request path.
- Added a pure parser for actual `#result_contents` / `#shopData_list` product cards, using observed `data-pid`, `data-bid`, `data-name`, and product-link identity. It excludes unrelated recommendations, verifies the requested ISBN, keeps distinct products, and tolerates missing optional metadata. Unexpected markup, inconsistent result structure, and unverifiable required identities do not become a false successful empty response.
- Added `src/lib/isbn.ts` to normalize ISBN-shaped queries before transport and share exact/safely equivalent matching across parsers. Valid ISBN-10 and corresponding `978` ISBN-13 identities match, including ISBN-10 `X`. Invalid checksums do not gain cross-format equivalence, `979` is not converted, and existing exact-match behavior remains available without a new blanket checksum rejection policy.
- Updated bounded preview validation so ISBN-10 `X` survives existing result-to-review navigation. The scanner, camera controls, and general keyword normalization were not changed.
- Search requests use the known Kyobo search host, encoded query parameters, rejected redirects, eight-second per-request timeouts, and streaming two-megabyte response limits. The maximum is one autocomplete request and one fallback request. No product-page requests, Chromium, recursive retries, new cache, or unbounded pagination were added to search.
- Added `probeKyoboSearch()` diagnostics shared by the normal provider and CLI, retaining source URLs, accepted/rejected/matching counts, failures, and available network-cause context. Search-page failures are logged server-side and still render a localized unavailable state distinct from valid no-match results.
- Added `--compare-search` to the existing probe. Both this mode and ordinary probing avoid product scraping; full metadata is now requested explicitly with `--details`. Updated `docs/verification.md` with the commands and request bounds.
- Kept the captured reproduction in `src/lib/kyobo-search-fixtures.ts`. Only nonproduction mode with `KYOBO_TEST_FIXTURE=1` substitutes those upstream responses; the request/parser/fallback orchestration still runs. Existing deferred-add fixtures remain intact.

## Regression Coverage

- Added focused ISBN tests for normalized input, ISBN-10 `X`, validated equivalence, nonconvertible `979`, invalid-checksum non-equivalence, exact-match compatibility, and invalid 11/12-digit identity shapes.
- Added provider tests for the minimized live mismatch, product identity/link validation, deduplication, distinct editions, unrelated cards/recommendations, missing optional metadata, ebook identities, genuine empty structure, malformed/challenge pages, normalized request parameters, fallback selection, HTTP/schema/timeout failures, streaming and declared size limits, diagnostic counts/causes, and production fixture guards.
- Added async search-page tests for returned preview links, Korean/English empty versus unavailable states, internal error logging without UI exception leakage, readable-library combined search, and library-only search making no Kyobo call.
- Added a desktop/mobile browser regression that starts with a decoded formatted ISBN, passes through the actual autocomplete-miss/full-search-hit pipeline, and verifies the result, review URL, preview context, and overflow behavior. Existing scanner and deferred-add tests were left unchanged and passed as compatibility coverage.

## Verification Results

- Targeted provider/ISBN/preview/search-page Vitest run: Passed, initially 70 cases across five files. A later diagnostic-cause regression was included in the final full run.
- `npm test`: Passed, 231 tests across 37 files.
- `npm run lint`: Passed.
- `npm run typecheck`: Passed.
- `npm run build`: Passed.
- Prettier checks against changed files and `git diff --check`: Passed.
- Created isolated PostgreSQL database `library_test_15` on the existing development database service. `DATABASE_URL='postgresql://library:library@library-dev-db:5432/library_test_15?schema=public' npm run db:migrate` applied all six existing migrations. No new schema migration was needed.
- `PLAYWRIGHT_DATABASE_URL='postgresql://library:library@library-dev-db:5432/library_test_15?schema=public' npm run test:e2e`: Passed, 23 project cases with one expected desktop skip for the mobile-only scanner test. The mobile scanner passed. The suite used the existing owned port-3100 server and isolated test database, with no live Kyobo access.

## Live Verification

With fixtures disabled, live comparisons at `2026-10-16T08:37:43Z` through `08:37:47Z` recovered all eight independently reproduced misses listed above. Each reported zero autocomplete documents and one validated website match with the same ISBN/product identity observed before implementation. `9791157107223` still returned `S000001750574` through autocomplete alone, without fallback.

Representative commands executed during verification:

```bash
KYOBO_TEST_FIXTURE=0 npm run kyobo:probe -- --compare-search 9780132350884
KYOBO_TEST_FIXTURE=0 npm run kyobo:probe -- --compare-search 9791157107223
KYOBO_TEST_FIXTURE=0 npm run kyobo:probe -- --compare-search 9799999999999
KYOBO_TEST_FIXTURE=0 npm run kyobo:probe -- --compare-search '978-0-13-235088-4'
KYOBO_TEST_FIXTURE=0 npm run kyobo:probe -- --compare-search 0132350882
```

The formatted and ISBN-10 Clean Code queries were additionally checked at `08:40:54Z` and `08:40:56Z`. Both returned `S000006148336` with canonical ISBN `9780132350884`; the ISBN-10 website response contained two product cards, but only the safely equivalent identity was returned. The `9799999999999` query returned no exact matches despite 20 unrelated website cards, demonstrating that recommendations are not substituted for a missing ISBN. The separate nonsense keyword `qzxvnonexistentisbnprobe` returned an empty autocomplete result, and independent website inspection showed `data-total-count="0"`.

No external-service or browser blocker remains for this task's verification. The user's precise failing ISBN was not supplied; the fix is supported by independently reproduced website/app mismatches rather than a claim to have tested that unspecified input. Live catalog behavior can change, and the fallback examines the returned result page rather than crawling pagination.

## Scope And Version

- Updated `package.json` and both root-version entries in `package-lock.json` from `0.7.5` to `0.7.6`, following the project's patch-version convention. No dependency, database schema, release tag, or publication was added.
- Preserved library authorization, search-source behavior, localized messages, and the add-time canonical metadata/options boundary. Search and review navigation do not invoke `getKyoboBook()`; the separate `--details` diagnostic remains opt-in.
- Restored generated `next-env.d.ts` to its original contents after verification. Left `.env`, `todo.md`, and the task goal/plan/review unchanged. No system package or browser installation was performed.
