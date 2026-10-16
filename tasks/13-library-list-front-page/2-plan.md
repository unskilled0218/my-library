# plan

- [scope](#scope)
- [Implementation Plan](#implementation-plan)
  - [1. Share the protected library list between both routes](#1-share-the-protected-library-list-between-both-routes)
  - [2. Make the home link target the front page](#2-make-the-home-link-target-the-front-page)
  - [3. Keep the new list route fresh after library changes](#3-keep-the-new-list-route-fresh-after-library-changes)
  - [4. Add regression coverage](#4-add-regression-coverage)
  - [5. Validate the implementation](#5-validate-the-implementation)
- [Acceptance Criteria](#acceptance-criteria)
- [Risks And Decisions](#risks-and-decisions)

## scope

Replace the promotional front page with the authenticated user's existing library list. Preserve owned and shared library visibility, localized content, library cards, empty state, and the library creation form. Keep `/libraries` working for existing links and redirects. This task requires no database migration, new dependencies, or changes to library authorization.

## Implementation Plan

### 1. Share the protected library list between both routes

- Move the server-rendered implementation from `src/app/libraries/page.tsx` into `src/components/libraries-page.tsx`, retaining its server-only behavior without a `use client` directive.
- Make `src/app/page.tsx` and `src/app/libraries/page.tsx` thin route exports of that shared implementation. Render the list directly at `/`; do not redirect authenticated visitors away from the front page.
- Keep `requireUser()` before the library query. Signed-out, expired-session, disabled-account, and administrator-only visitors follow the existing user-authentication boundary and redirect to `/login`.
- Preserve the exact query scope: libraries owned by the user or containing a membership for that user, ordered by `updatedAt` descending, including book counts and the current user's membership role. Do not include unrelated libraries or restrict the list to editable memberships.
- Preserve `libraries-page`, `library-create-form`, and `library-card-list` element IDs, existing layout classes, role labels, book counts, description fallback, localized empty state, and `/libraries/{id}` card destinations.
- Preserve the form's `createLibraryAction`, required name, 100-character name limit, optional description, 500-character description limit, and position above the cards. Remove the promotional JSX from the root route without deleting unrelated translation files.

### 2. Make the home link target the front page

- Change the `MY / LIBRARY` link in `src/app/layout.tsx` to use `/` consistently, so authenticated users reach the new front page from any screen.
- Keep login, registration, logout, administrator navigation, header search, and settings controls unchanged. Existing successful login and registration redirects to `/libraries` remain valid because both list routes share the same implementation.

### 3. Keep the new list route fresh after library changes

- In `src/app/actions.ts`, add root-page revalidation alongside existing `/libraries` revalidation in `createLibraryAction` and `updateLibraryAction`.
- In `deleteLibraryAction`, invalidate both list pages after successful deletion and before the existing `/libraries` redirect, preventing previously visited root lists from retaining a deleted card.
- Use page-scoped `revalidatePath('/')`, not root-layout invalidation. Preserve mutation authorization checks, validation, transactions, file cleanup, and redirect destinations.
- Check the existing language-change flow continues to refresh the shared list through its existing cookie and layout invalidation behavior; do not redesign cache handling or expand unrelated mutation flows.

### 4. Add regression coverage

- Add `src/components/libraries-page.test.tsx` using the existing Vitest server-page pattern: mock authentication, Prisma, language lookup, and server actions; await the server component and inspect rendered output.
- Assert unauthenticated requests stop before `db.library.findMany`, and authenticated requests use the current user's owner-or-member filter, descending update order, and required count/role includes.
- Cover owner, editor, and viewer cards; owner precedence when an owner also has a membership; book counts; description fallback; card links; and the empty state. Check both Korean and English list text without duplicating translation definitions.
- Assert the creation form remains above the cards with its input constraints and submit control. Add route-level coverage proving both `/` and `/libraries` use the shared protected implementation.
- Extend action tests, using dedicated test files if existing mocks would become unwieldy, to verify successful create, update, and delete invalidate both list routes while preserving existing redirects and authorization behavior.
- Replace the obsolete promotional-heading assertions in `e2e/smoke.spec.ts` with signed-out `/` redirect and usable login/header-search assertions. Keep the mobile ISBN-scanner test working on the redirected login page.
- Add a focused front-page browser scenario with registration as setup: visit `/`, assert the URL remains `/`, show the default library and creation controls, create a uniquely named library from the root form, follow the existing detail redirect, and use the brand link to verify the card appears when returning home. Confirm `/libraries` still renders the same list.
- Keep existing settings, filtering, and view-persistence assertions in their current registration scenario rather than extending it with the new front-page checks. Reuse only a small registration helper if needed. Preserve the language-switch regression in its existing flow and assert the brand link returns to `/` with the English list visible. Check desktop and mobile layouts remain free of horizontal overflow.
- Add a separate browser lifecycle scenario for list freshness: register a user, visit `/` to establish previously visited list state, open an owned test library's settings, rename it and change its description, then return through the brand link and assert the updated card text. Delete that library through the existing confirmation flow, assert the preserved `/libraries` redirect, then use the brand link to return to `/` and assert the card is absent. Use client navigation for return-home checks without full reloads so the test exercises cached list state.
- Add a two-user browser regression using isolated contexts: an unrelated private library is absent from the other user's root list; sharing it as a viewer makes its card and viewer label visible, while the creation form remains available for that user's own libraries.

### 5. Validate the implementation

- Run targeted Vitest coverage for the shared list, route wiring, and changed actions, then run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- Run Prettier checks against only changed files, avoiding unrelated formatting changes.
- Run `npm run test:e2e` for the configured desktop and mobile projects. Follow `docs/local-development.md` and `docs/verification.md` for database, browser, and server prerequisites; use an isolated test database because registration and sharing tests write data.
- Report missing services, browsers, or other verification blockers rather than installing system packages or modifying unrelated environment files.

## Acceptance Criteria

- A signed-in user visiting `/` stays at `/` and sees their library list instead of promotional content.
- The list contains owned and shared libraries, including viewer memberships, but no unrelated private libraries; roles, order, counts, links, descriptions, and empty state match existing behavior.
- Signed-out visitors to either list route are redirected to `/login` without querying libraries. Administrator-only sessions do not grant user-library access.
- The existing localized creation form stays above the cards, retains its limits, and creates an owned library using the existing action and detail redirect.
- `/libraries` remains a supported list route, and the site brand opens `/`.
- Creating, renaming, or deleting a library does not leave stale cards when returning to the root list. Browser checks verify newly created cards, updated names and descriptions, and deleted-card absence through client navigation without full reloads.
- Korean and English rendering, header search, and responsive desktop/mobile behavior remain functional.
- Relevant automated checks pass, or concrete environment blockers are recorded.

## Risks And Decisions

- The goal does not specify a public replacement page. Use the existing list's `requireUser()` behavior, making `/login` the signed-out entry point rather than exposing any library data.
- Keep `/libraries` as an equivalent route, not a redirect, to avoid changing existing bookmarks, navigation destinations, and authentication tests beyond this task's scope.
- Share one implementation rather than copying the page or importing one App Router page into another. This keeps authorization, query scope, and creation controls consistent.
- Mocked query assertions protect filter construction but do not prove database isolation. The two-user browser regression verifies visibility against real persisted memberships.
- Keep front-page and lifecycle browser scenarios focused rather than adding unrelated assertions to the existing registration scenario. Mocked revalidation assertions verify action boundaries; browser return-home checks verify actual list freshness.
- Root-page caching is newly relevant. Limit invalidation changes to library metadata and lifecycle actions needed by this task, avoiding a broader cache refactor.
- The working tree already contains a user change in `next-env.d.ts`. Preserve it and exclude it from task commits. Do not modify `todo.md` or implementation code during this planning task.
