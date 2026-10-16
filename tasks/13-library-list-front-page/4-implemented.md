# Implementation

- [Implementation](#implementation)
  - [Changes](#changes)
  - [Regression Coverage](#regression-coverage)
  - [Verification Results](#verification-results)
  - [Browser Verification Blockers](#browser-verification-blockers)
  - [Version And Scope](#version-and-scope)

## Changes

- Created branch `13-library-list-front-page` from `main`.
- Moved the existing authenticated library list unchanged into `src/components/libraries-page.tsx`. Both `/` and `/libraries` export this shared server page directly. Signed-in root visitors keep the `/` URL; signed-out visitors follow the existing `/login` boundary.
- Preserved the owner-or-member query, viewer visibility, update ordering, book counts, membership roles, localized labels and empty state, card destinations, and creation form constraints and placement.
- Changed the site brand link to `/` for all visitors. Existing login, registration, and mutation redirect destinations remain intact.
- Added page-scoped root invalidation to library create and update actions. Library deletion now invalidates both list routes after cleanup and before its existing `/libraries` redirect.
- Retained the existing language action's cookie update and root-layout invalidation. Its existing unit regression passes, and the browser language flow now explicitly checks return to `/`.

## Regression Coverage

- Added `src/components/libraries-page.test.tsx` for both route exports, authentication-before-query behavior, exact query scoping and ordering, owner precedence over membership, editor/viewer cards, counts, descriptions, links, Korean and English rendering, empty state, and form placement and limits.
- Added `src/app/actions-library-list.test.ts` for owned creation, owner-only update, both list invalidations, existing redirect behavior, rejected authentication and authorization, and empty-name validation.
- Extended deletion cleanup tests to verify both list invalidations precede redirect and denied owner access prevents deletion and invalidation.
- Replaced promotional smoke assertions with signed-out root redirect and usable login/header-search checks. Kept scanner coverage and existing settings/filtering assertions in their current scenarios.
- Added focused browser scenarios in `e2e/libraries.spec.ts` for root URL retention, default-library visibility, root-form creation, legacy-route equivalence, rename/delete freshness through client navigation, and persisted private/viewer visibility using isolated user contexts. Added desktop/mobile overflow assertions to the front-page and sharing scenarios.
- The existing delete form submits directly; there is no confirmation dialog to handle. The lifecycle regression follows that existing flow without changing deletion behavior.

## Verification Results

- Targeted Vitest run: Passed, 17 tests across the shared page, library-list actions, and deletion cleanup tests.
- `npm test`: Passed, 131 tests across 31 files.
- `npm run lint`: Passed.
- `npm run typecheck`: Passed.
- `npm run build`: Passed. Next.js reports both `/` and `/libraries` as dynamic server-rendered routes.
- Prettier checks against all changed implementation, test, package, and task-report files: Passed.
- `git diff --check`: Passed.
- `npx --no-install playwright test --list`: Passed, discovering 18 cases across two files and both configured projects. The existing scanner case remains mobile-only.
- `npm run test:e2e`: Blocked before browser execution. The configured development server exited during administrator bootstrap because PostgreSQL at `db:5432` was unreachable. No browser scenarios ran.
- Separate Chromium launch prerequisite check: Failed because the Playwright Chromium executable is not installed.

## Browser Verification Blockers

- Provide a reachable, isolated PostgreSQL test database and set `DATABASE_URL` for verification, then run `npm run db:migrate`. The current `.env` points at unreachable `db:5432`; no database writes or migrations were attempted against it.
- Install the Playwright Chromium browser with `npx playwright install chromium`. If browser system libraries are also missing, install the dependencies reported by Playwright through the environment's normal setup process.
- Rerun `npm run test:e2e` after both prerequisites are ready. Browser navigation, real membership isolation, cache freshness, and responsive layout assertions remain unverified until that run completes.
- No system packages, browsers, services, or environment configuration were installed or changed during this task.

## Version And Scope

- Updated `package.json` and both root-version entries in `package-lock.json` from `0.7.3` to `0.7.4`, following the previous feature task's patch-version convention. No release tag or publication was requested.
- No database migration or dependency change was needed. Promotional translations remain available.
- Preserved the pre-existing `next-env.d.ts` working-tree contents after Next.js regenerated that file during verification; exclude it from the implementation commit. Left `todo.md` unchanged.
