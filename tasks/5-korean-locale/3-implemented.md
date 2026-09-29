# Implemented Korean and English locales

## Version

- `0.4.0`

## Changes

- Added a Prisma `Language` enum and Korean-default account setting, including
  an existing-user migration and generated client support.
- Added typed Korean/English feature dictionaries, request-cached server locale
  resolution, a client locale provider, explicit locale date/count formatting,
  and localized metadata and document language.
- Added a General Settings language selector. Authenticated preferences take
  precedence over a validated continuity cookie; sign-in synchronizes the
  cookie and sign-out leaves it intact. Administrator pages use cookie/default
  language without adding an administrator preference.
- Localized the complete application-owned interface across landing, auth,
  settings, libraries, books, search, scanner, Kyobo review, statistics, audit,
  transfer, errors, accessibility text, and administrator pages. Persisted
  enum/form values and user/Kyobo content remain unchanged.
- Replaced expected auth, password, language, search, and transfer feedback
  with stable codes translated at the rendering boundary. Transfer imports
  refresh the interface after applying an account language.
- Added account backup version 2 with language persistence while retaining
  version 1 import compatibility and preserving the current language for old
  backups. Library backup version 2 remains unchanged.
- Changed the generated default library name to `내 서재`, documented locale
  behavior and backup compatibility, and added migration, resolver, cookie,
  action, auth, dictionary/helper, component, transfer, and browser coverage.

## Verification

- `npm run db:generate` passed.
- `npm run format:check` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed: 17 files, 50 tests.
- `npm run build` passed.
- `npm run db:migrate` was blocked by `P1001`: PostgreSQL is unavailable at
  `db:5432`.
- `npm run test:e2e` was blocked before test execution because the development
  server cannot create the root-owned `.next/dev` lock; the configured database
  is also unavailable for the registration flow.
