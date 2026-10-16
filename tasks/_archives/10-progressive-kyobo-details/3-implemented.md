# Progressive Kyobo details implementation

## Changes

- Added bounded Kyobo preview parsing and URL builders with strict sale ID, ISBN, format, author, title, and HTTPS cover-host validation.
- Added `/search/kyobo/[saleId]` with an immediate search-result preview, accessible Suspense loading state, canonical product details, retry and back navigation, duplicate feedback, and authenticated destination controls.
- Changed Kyobo result selection and legacy selected URLs to use the dedicated detail route without blocking `/search` on a product-page scrape.
- Kept URL preview fields display-only. Duplicate checks, covers, genres, persisted metadata, and authorization continue to use the canonical product scrape.
- Removed the Kyobo modal, scroll lock, focus trap, and modal tests.
- Added Korean and English detail-page messages and documented the preview/canonical metadata boundary.
- Added unit and component coverage for preview validation, legacy redirects, canonical detail states, destination authorization, forged preview isolation, and duplicate redirects.
- Added a non-production deterministic Kyobo fixture and desktop/mobile Playwright flow covering navigation, preview, loading, enrichment, browser back, and horizontal overflow.
- Updated the project and deployment example version from `0.7.0` to `0.7.1`.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 28 files and 105 tests.
- `npm run build`: passed, including the new dynamic detail route.
- `git diff --check`: passed.
- `npm run test:e2e`: could not start because PostgreSQL was unavailable at the configured `db:5432` host. The Playwright server exited during Prisma instrumentation before any browser test ran.
- Live `npm run kyobo:probe -- 9791157107223` was not run because external Kyobo access was not required for deterministic verification.
