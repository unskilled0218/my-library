# Rich Kyobo search metadata implementation

## Changes

- Expanded the Kyobo autocomplete parser to validate and expose coarse category, publisher, publication year/month, list and sale prices, discount, reward points, rating, description, cover, and category code.
- Added defensive runtime validation so malformed provider documents or optional fields are skipped without hiding valid results.
- Deduplicated autocomplete documents by sale ID with first-valid-result precedence while preserving distinct physical and e-book editions.
- Added localized rich metadata rendering for search cards and immediate detail previews, with locale-aware won and numeric formatting and narrow-screen word wrapping.
- Extended the untrusted preview contract with strict scalar bounds, a 300-character description excerpt, truncation tracking, and a 4,000-character encoded query budget with deterministic optional-field pruning.
- Routed retry and duplicate-feedback URLs through the same bounded preview serializer.
- Changed progressive details to omit unchanged title, contributors, ISBN, format, cover, and description; canonical corrections render per field, missing preview values render as enrichment, and truncated descriptions render only their canonical continuation.
- Kept full genre paths and all persisted book data canonical. Search-only commercial metadata remains display-only and does not alter the database schema or add action.
- Added parser, preview-budget, duplicate, malformed-runtime-data, action trust-boundary, localized metadata, correction, direct-link, continuation, and deterministic browser assertions.
- Updated the application version from `0.7.2` to `0.7.3`.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 29 files and 116 tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run kyobo:probe -- "나미야 잡화점"`: passed; three live results exposed all expected rich fields and preserved distinct physical/e-book editions.
- `npm run test:e2e -- --grep "Kyobo details load progressively"`: could not start because PostgreSQL was unavailable at the configured `db:5432` host. Next.js exited during Prisma instrumentation before Playwright launched.
