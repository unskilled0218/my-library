# Validate Kyobo scraping before application development

## Goal

Build and run an isolated, disposable spike that proves whether the target server environment can reliably search Kyobo and extract the required book fields before any application implementation begins. Do not connect the spike to the application database, authentication, UI, or production runtime.

## Live observations

- On 2026-09-28, requesting the autocomplete endpoint without `callback` returned plain JSON; requesting it with `callback=autocompleteShop` returned the same payload wrapped as JSONP. The spike should prefer plain JSON and must never evaluate JSONP as JavaScript.
- Searching ISBN `9791157107223` returned exactly one document whose `CMDT_NAME` is `너의 췌장을 먹고 싶어`, `CMDTCODE` is `9791157107223`, and `SALE_CMDTID` is `S000001750574`.
- Searching title `너의 췌장을 먹고 싶어` returned four documents and the expected physical book was first at observation time. For an ISBN query, use the first result as required, then validate that its normalized ISBN exactly matches the query before using it.
- `SALE_CMDTID` produces product URL `https://product.kyobobook.co.kr/detail/S000001750574`.
- The supplied cover URL returned `200 image/jpeg` with a non-empty body and can be downloaded independently.
- The product page returned HTTP 200 with an empty body and `x-cache: Error from cloudfront` from this environment. Product scraping is therefore unproven and must pass the runtime probe below before application work starts.

## Expected normalized result

Use the supplied book as the fixed acceptance fixture:

- `title`: `너의 췌장을 먹고 싶어`
- `authors`: `['스미노 요루']`; preserve all authors in page order when multiple author links are present.
- `isbn`: `9791157107223`
- `sourceUrl`: `https://product.kyobobook.co.kr/detail/S000001750574`
- `coverUrl`: an HTTPS URL on `contents.kyobobook.co.kr` whose downloaded body is a valid, non-empty image.
- `description`: normalized text from `#bookSimpleIntro`; do not merge the longer `#bookDescription` into the short Book description.
- `genrePaths`: two complete root-to-leaf paths, preserving names, canonical URLs, and page order: `국내도서 > 소설 > 일본소설 > 드라마/영화소설` and `국내도서 > 소설 > 장르소설 > 드라마/영화소설`.

Because one book has multiple genre paths, the application design must use a many-to-many `BookGenre` association to tree-structured `Genre` nodes rather than a single genre foreign key. Shared ancestors and same-named leaf nodes must be resolved by canonical Kyobo URL, not name alone.

## Spike implementation

1. Create a standalone TypeScript spike under `spikes/kyobo/` with its own documented command and no imports from future application modules. Use the project's eventual HTTP and HTML parsing libraries only if they have already been selected; otherwise keep dependencies minimal and record them for the main plan.
2. Implement `searchKyobo(keyword)` against `https://search.kyobobook.co.kr/srp/api/v1/search/autocomplete/shop` using `URLSearchParams`, no callback parameter, an abort timeout, bounded response size, explicit JSON/content validation, and typed mapping from `data.resultDocuments`. Return an ordered list and treat missing arrays or non-success result codes as errors.
3. Implement ISBN selection separately from ordinary keyword selection: normalize hyphens/spaces, take the first returned document, require its normalized `CMDTCODE` to exactly match the query, and only then build the product URL from a validated `SALE_CMDTID`. Assert this fixture has one result and the first result is the exact ISBN match. For ordinary keywords, retain all mapped results in Kyobo's returned order.
4. Save sanitized autocomplete fixtures for the ISBN and title responses so parser tests are deterministic. Do not rely on live requests in the normal automated test suite, and do not snapshot volatile score, price, or ranking values.
5. Probe the product page from the same Node runtime, network, DNS, and container that will run the application. Record status, redirect chain, content type, byte count, and relevant cache/error headers without recording cookies. Try one normal descriptive user agent and standard HTML accept headers; do not add stealth tooling, rotate identities, solve challenges, or bypass access controls.
6. If the plain HTTP response contains HTML, parse it with structural selectors anchored to the supplied semantic markers: title from `h1[aria-label]` with inner-text fallback, authors from the author section links targeting `#authorInfo`, ISBN from the specification row whose header text is `ISBN`, short description from `#bookSimpleIntro`, and each genre path from the category breadcrumb list. Normalize whitespace and `<br>` boundaries without stripping Korean text.
7. If the HTTP response remains empty, run one headed or headless Playwright diagnostic with JavaScript enabled to determine whether an ordinary browser session receives rendered HTML. Capture only status/console diagnostics and a local HTML fixture; do not implement browser automation as the production scraper unless its operational cost and reliability are explicitly approved after the spike.
8. Parse all genre breadcrumb rows, preserving each full path and every anchor's absolute canonical Kyobo category URL. Assert both expected paths are present and verify that repeated ancestors deduplicate by URL while both book-to-leaf/path associations remain represented.
9. Download the selected cover into a temporary directory using the security limits planned for production: allowlisted HTTPS host, redirect cap, timeout, maximum bytes, content-type plus file-signature validation, generated filename, and cleanup after the test. Assert the fixture is a valid non-empty image; do not retain the Kyobo query-string filename.
10. Add fixture-based tests for valid extraction, multiple authors, both genre paths, changed/missing selectors, malformed autocomplete JSON, no results, no exact ISBN match, empty product HTML, invalid/oversized cover responses, timeout, and upstream non-success responses.
11. Run the live probe as an explicit opt-in command, separate from deterministic tests. Print a redacted machine-readable report containing pass/fail per field, response metadata, and selector failures, but do not commit downloaded pages or images until they have been reviewed for size, sensitive data, and repository suitability.
12. Record the spike result in the implementation report. Include request date, runtime/container, observed response behavior, extracted fixture values, selected dependencies, known fragility, and a clear go/no-go recommendation for the Kyobo integration.

## Go/no-go rules

- Proceed with the planned server-side provider only if the autocomplete search, product metadata extraction, two genre paths, and cover download all pass repeatedly from the target runtime without access-control circumvention.
- If autocomplete works but product HTML remains unavailable, do not infer authors or genre trees from brittle positions inside `TOT_RELATE_HTML_LIST`. Keep the provider boundary, require manual entry with canonical Kyobo book/genre URLs, and document product scraping as blocked.
- If ordinary browser rendering works but direct HTTP does not, stop after documenting the result and obtain approval before adding browser infrastructure to the production design.
- Treat selector drift as an isolated provider failure with actionable diagnostics; it must not create partial books or incomplete genre trees.

## Verification commands

The spike implementation must add and document commands equivalent to:

- Run deterministic fixture tests.
- Run type checking and linting for the spike.
- Run the opt-in live ISBN probe for `9791157107223`.
- Run the opt-in live title probe for `너의 췌장을 먹고 싶어` and print the ordered result list.

Do not begin the main application implementation until deterministic tests pass and the live report produces a go decision or the manual-entry fallback is explicitly accepted.
