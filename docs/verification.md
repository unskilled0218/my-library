# Verification

- [Verification](#verification)
  - [Browser tests](#browser-tests)
  - [Live Kyobo diagnostic](#live-kyobo-diagnostic)

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Browser tests

Browser tests require Chromium and a disposable PostgreSQL database separate from `library` and seeded `library_dev`. Set `PLAYWRIGHT_DATABASE_URL` to its connection URL, then apply migrations and run:

```bash
DATABASE_URL="$PLAYWRIGHT_DATABASE_URL" npm run db:migrate
npm run test:e2e
```

Playwright launches its own fixture-enabled Next.js server on port 3100 and refuses to reuse an existing server. Keep that port free. The server receives the explicit test database URL, uses `.next/e2e` for build output and uploaded test files, and does not inherit the normal development database connection. A normal development server can continue on port 3000. Tests create accounts and books; use a disposable database and clean it up after verification.

If Chromium is missing, install it with `npx playwright install chromium` through the environment's normal setup process. The add-time Kyobo browser fixtures never contact live Kyobo. Failure/retry scenarios use unique product IDs per scenario, project, and retry, so their fail-once state cannot be consumed by another test.

## Live Kyobo diagnostic

Live Kyobo access is not part of the normal test suite. Compare normalized input, autocomplete/fallback document counts, verified matches, and the public website URL with fixtures disabled:

```bash
KYOBO_TEST_FIXTURE=0 npm run kyobo:probe -- --compare-search 9780132350884
KYOBO_TEST_FIXTURE=0 npm run kyobo:probe -- --compare-search 9791157107223
```

The comparison does not fetch product detail pages or require Chromium. For ISBNs, a full-search fallback runs only after an autocomplete miss or error. Each upstream request has an eight-second timeout and a two-megabyte body limit, with at most two requests total. The report retains failed stage context even when a later source recovers. A verified empty response is distinct from an unavailable or unrecognized response.

The ordinary probe also searches without fetching full product metadata. Request product details explicitly when diagnosing the add-time scraper:

```bash
npm run kyobo:probe -- --details 9791157107223
npm run kyobo:probe -- "너의 췌장을 먹고 싶어"
```
