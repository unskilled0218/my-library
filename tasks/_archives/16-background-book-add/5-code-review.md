# Brooks-Lint Health Dashboard

- [Review Basis](#review-basis)
- [Dimension Scores](#dimension-scores)
- [Module Dependency Graph](#module-dependency-graph)
- [Test Suite Map](#test-suite-map)
- [Top Findings](#top-findings)
  - [Warning](#warning)
- [Verification](#verification)
- [Recommendation](#recommendation)

**Mode:** Health Dashboard

**Scope:** All 30 committed files changed on `16-background-book-add` relative to `main`, using merge base `b9d8db9` and reviewed HEAD `d4262ed`. The three included commits are `2118644`, `7289e2a`, and `d4262ed`. This covers implementation, tests, documentation, package version changes, task records, and Vitest configuration. The preserved `16-background-book-add-previous` branch is not the integration base. The uncommitted generated `next-env.d.ts` change is outside the review.

**Composite Score:** 98/100

**Trend:** 95 → 98 (+3) relative to the previous recorded Health Dashboard. That earlier run reviewed the proposed plan, so this is not a comparable implementation-quality trend.

**Verdict:** Revise before merge. The architecture is proportionate, but two mounted-form lifecycle gaps remain and real browser acceptance is still unverified.

## Review Basis

Read the task goal, updated plan, review feedback, implementation record, all branch diffs, and relevant authentication, authorization, query rendering, fixture, and test configuration seams. Applied R1–R6 and T1–T6, with the abbreviated dashboard emphasis on R1/R2, dependency direction, and T1/T2. No `.brooks-lint.yaml` exists; balanced defaults apply. Temporary component probes diagnosed the two findings and were removed after execution. No production code, existing tests, or fixes were retained in this stage.

The server-only import extraction is a useful deep boundary. Endpoint and compatibility-action adapters legitimately differ in transport, redirect, and duplicate-error semantics. The root-layout provider, ordinary fetch, explicit retry, and indeterminate non-modal panel fit the open-tab goal. The documented cross-tab check-before-create race and lack of durable jobs are deliberate scope limits, not new findings. No runtime dependency cycle was found: the panel's reference back to the provider is type-only and erased.

## Dimension Scores

| Dimension | Score | Top Finding |
| --- | --- | --- |
| Code Quality | 100/100 | No separate R1/R2 finding; the import remains linear and adapters stay thin. |
| Architecture | 100/100 | Client/server boundaries and provider lifetime are coherent under static inspection. |
| Tech Debt | 90/100 | Two R6 warnings: query controls and failed-task editing do not fully reconcile retained local state. |
| Test Quality | 100/100 | No separate T1/T2 finding; mounted-transition gaps are documented with the production findings. |

Each dimension starts at 100. The two displayed warnings each deduct 5 from Tech Debt and are counted once. Composite calculation: `100 × 0.25 + 100 × 0.30 + 90 × 0.25 + 100 × 0.20 = 97.5`, rounded half-up to 98. There are zero Critical findings, two Warnings, and zero Suggestions. This bounded static score is not browser acceptance or merge approval.

## Module Dependency Graph

```mermaid
graph TD
  Layout[Root layout] --> Locale[LocaleProvider]
  Locale --> Provider[BookAddProvider / user-keyed session]
  Provider --> Panel[BookAddStatus]
  Form[KyoboAddBookForm] --> Provider
  Layout --> Header[HeaderSearch]
  LibraryPage[Library page] --> Filters[LibrarySearchControls]
  Header --> Router[Next client router]
  Filters --> Router
  Provider --> Router
  Provider -->|POST fetch| Route[API route]
  Route --> Auth[currentUser]
  Route --> Import[Server-only Kyobo import]
  Action[Compatibility Server Action] --> Import
  Import --> Access[WRITE access checks]
  Import --> Options[Client-safe option validation / result types]
  Import --> Kyobo[Canonical metadata retrieval]
  Import --> Covers[Cover storage]
  Import --> DB[Prisma transaction / audit / genres]
  Access --> DB
  Provider -. type-only .-> Options
  Panel -. type-only .-> Provider
```

The normal request is owned by the shared provider rather than the detail page. Session keys and inactive-session checks isolate late responses after identity changes. Native search interception preserves the provider, but preserving page components also requires explicit reconciliation of form state, as the findings show.

## Test Suite Map

- Repository Vitest suite: 39 files and 253 passing cases. Seventeen library/helper files cover parsing, validation, fixtures, migrations, and related rules; ten jsdom component files cover UI behavior; four server-rendered component/page files cover rendered output; five action files and three API route files cover server boundaries with mocked dependencies. These categories describe test seams, not 39 real-database integration suites.
- This branch changes seven Vitest files: import/action assertions, endpoint handling, detail-page rendering, provider/panel lifecycle, Kyobo form submission, header search, and library search controls. Deferred provider responses cover independent completion, page unmount, collapse, duplicate submission, identity changes, uncertain outcomes, explicit retry, and sign-in recovery.
- Browser suite: five spec files containing 15 scenarios, expanded to 30 cases across desktop and mobile. This branch adds the three background-addition scenarios and updates two existing specs while retaining canonical metadata and option-persistence assertions.
- The request-before-forwarding gate and committed-but-lost-response simulation exercise distinct risks correctly. The existing tests mount fresh controls or navigate away before restoring failed options; they do not cover the retained-instance transitions in the two findings. Browser enumeration is successful, but no browser persistence result is available.

## Top Findings

### Warning

**1. R6 — Tech Debt: Failed-task editing cannot restore a snapshot on the same mounted review route.**

- **Symptom:** `src/components/kyobo-add-book-form.tsx:42-80` restores failed values only in the `useState` initializer. Destination switching at lines 102–105 changes local fields without changing the URL. `src/components/book-add-status.tsx:94-99` implements “Edit options” only as a link and panel collapse, while `src/app/search/kyobo/[saleId]/page.tsx:143` keys the form by the route's product and selected destination. Reproduction: open product/library A, submit A and receive an error, select B and change its draft, then open A's “Edit options” link. That link can target the already-current A URL, leaving the route key unchanged and the form on B. A temporary retained-instance probe confirmed that rerendering the same A route left destination B selected instead of A; snapshot initialization did not rerun. This is component-level evidence combined with the link/key path, not an executed Next.js browser-navigation result.
- **Source:** *Domain-Driven Design* — faithful lifecycle modeling and invariant ownership; *A Philosophy of Software Design* — Information Hiding and Leakage. The meaning of “edit this failed task” currently depends on page remount behavior rather than an explicit recovery operation.
- **Consequence:** The failed task's options remain in provider memory, but its recovery control can show another destination and draft. A user following that control can submit the wrong destination or options instead of correcting the failed request. This falls short of the plan's restored-form recovery contract.
- **Remedy:** Give the edit control an explicit task-selection/restoration operation that works even when the destination URL is unchanged. Restore the chosen task's destination and snapshot while reconciling current writable choices; do not rely solely on a route-derived component key. Add a retained-instance regression for A failure → B draft → edit A, and verify it through the actual panel link in the browser suite.

**2. R6 — Tech Debt: Client-side library search retains controls from the wrong query.**

- **Symptom:** `src/components/library-search-controls.tsx:45-50` now performs client-side navigation, but the input at line 61 and selects at lines 89, 99, 109, 117, and 129 still use uncontrolled `defaultValue`. Their parent at `src/app/libraries/[id]/page.tsx:437-441` provides no query-derived key. A temporary probe rendered query `first`, changed and submitted `second`, then supplied `second` followed by `first` query props to model retained client navigation. The input remained `second`, not `first`. The existing submission test checks the outgoing URL only and misses this prop/state reconciliation.
- **Source:** *Domain-Driven Design* — faithful representation of query state; *Code Complete* — explicit state and invariant handling. The visible controls and the applied route query can describe different searches.
- **Consequence:** History navigation or query-changing links can render results for one query while displaying and resubmitting another. The hidden folder value updates from props while dirty search/filter controls can retain older values, producing an unintended combination on the next submission.
- **Remedy:** Reconcile controls when the normalized applied query changes, either through controlled state with explicit navigation synchronization or a query-keyed inner form. Keep the root background-task provider mounted. Add a rerender/history regression that checks displayed query/filter values, preserved folder scope, and the next submitted URL after navigation.

## Verification

- During this review, `npm test` passed: 39 files, 253 cases. `npm run typecheck` passed.
- Two temporary jsdom probes failed at the expected state assertions: library search expected `first` but retained `second`; failed-task recovery expected destination A but retained B. The probes were removed, and the repository's unchanged test suite was rerun successfully. They diagnose component retention only; they do not establish browser-level navigation behavior.
- `PLAYWRIGHT_DATABASE_URL="postgresql://library:library@library-dev-db:5432/library_test_16?schema=public" npx playwright test --list` successfully enumerated 30 cases in five files. Listing does not launch the server, execute cases, or verify persistence.
- The preceding implementation stage passed lint, production build, focused formatting, and diff checks, as recorded in `4-implemented.md`. Its browser attempt failed during fixture-server startup because Prisma could not reach `library-dev-db:5432`. This review did not repeat the same unavailable-database attempt or treat it as passing acceptance.
- The findings are static/component-level conclusions. Real desktop/mobile navigation, persistence, focus behavior under actual route refresh, and response-loss reconciliation still require execution against a reachable migrated disposable database.

## Recommendation

Fix explicit failed-task editing first, then reconcile library controls with applied query changes. Add focused retained-instance regressions and rerun the real desktop/mobile scenarios against a reachable disposable database before merge. A focused Tech Debt assessment is the appropriate follow-up for the state-ownership issues; the shared import service, HTTP adapter, provider scope, and explicit existing-book outcome can remain. No fixes were implemented in this review stage.
