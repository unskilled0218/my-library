# plan

- [scope](#scope)
- [Implementation Plan](#implementation-plan)
  - [1. Separate book import from navigation](#1-separate-book-import-from-navigation)
  - [2. Add a background request endpoint](#2-add-a-background-request-endpoint)
  - [3. Keep background additions in the shared layout](#3-keep-background-additions-in-the-shared-layout)
  - [4. Connect the add form and progress panel](#4-connect-the-add-form-and-progress-panel)
  - [5. Verify navigation, recovery, and existing import behavior](#5-verify-navigation-recovery-and-existing-import-behavior)
- [Acceptance Criteria](#acceptance-criteria)
- [Risks And Decisions](#risks-and-decisions)

## scope

Make Kyobo book additions continue during client-side navigation within the app. Users can search, open libraries, and submit another book while earlier additions run. A persistent, non-blocking status panel shows each addition's pending, success, or failure state and supports recovery without losing submitted options.

Use the existing Next.js server, import logic, and root layout. This task covers Kyobo additions from `KyoboAddBookForm`; manual entry keeps its current behavior. Background work lasts for the current open app session; durable jobs across reloads, tab closure, or server restarts are outside this task.

## Implementation Plan

### 1. Separate book import from navigation

- Extract the import body of `addKyoboBookAction` from `src/app/actions.ts` into a server-only module such as `src/lib/kyobo-import.ts`. Accept an authenticated user and submitted form data, and return a typed success containing `bookId` and `libraryId`, or an existing `KyoboAddError`.
- Preserve product and option validation, WRITE access checks, library-owner shelf validation, destination folder validation, authoritative Kyobo retrieval, ebook location clearing, duplicate detection, cover download and cleanup, transaction boundaries, genre updates, and audit logging.
- Return the created book ID from the transaction. Keep `q` and `source` as navigation context outside the import service; preview metadata remains display-only.
- Keep `addKyoboBookAction` as a thin compatibility wrapper that requires a user, invokes the service, revalidates affected paths, and retains its current success redirect and error contract. Add a separate success/error result type for the new endpoint rather than forcing redirect-based callers to change behavior.

### 2. Add a background request endpoint

- Add `POST /api/books/kyobo` in `src/app/api/books/kyobo/route.ts`. Use `currentUser()` to return a JSON authentication failure rather than redirecting a fetch to login, parse `FormData`, and call the shared import service.
- Restrict mutation requests to the same origin, accounting for the application's existing reverse-proxy deployment. Return typed JSON for expected errors, malformed requests, and unexpected failures; never expose an exception stack to the client.
- On success, revalidate `/`, `/libraries`, and the destination library, then return the created IDs. The endpoint must await the import before reporting success; do not launch an untracked promise after returning a response.
- Use an ordinary client `fetch` for this endpoint, independent of the Server Action submission queue, so a slow Kyobo request does not hold up unrelated navigation or form actions. No polling, streaming, database migration, or new package is needed.

### 3. Keep background additions in the shared layout

- Add a client provider such as `src/components/book-add-provider.tsx` under `LocaleProvider` in `src/app/layout.tsx`. Mount it across page changes and scope its state to the current user ID; clear task state when the authenticated identity changes and ignore late responses from an earlier identity.
- Store a unique task ID, `saleId`, destination ID/name, a display title with a localized fallback, the originating detail URL, an immutable snapshot of submitted option values, and `pending`, `success`, or `error` state. Keep snapshots in memory rather than URLs or browser storage.
- Expose submission and task lookup APIs to forms. Start requests from the provider, not a page component's lifetime; unmounting the detail page or collapsing the status panel must not abort an addition.
- Atomically guard against repeated submissions for the same `saleId` and library while pending. Allow different books to run independently, including completion in a different order. Keep successful entries guarded against immediate accidental resubmission until explicitly dismissed.
- On completion, update only the matching task. Refresh current route data after a successful save without changing the current URL or stealing focus; success links let users choose when to open the destination library or book.
- Retain failed snapshots for explicit retry and editing. Retry reconstructs the same submitted options and runs server validation again. Treat network loss as an uncertain result, show a distinct message, and never automatically retry a mutation; the existing duplicate check remains active on explicit retry.

### 4. Connect the add form and progress panel

- Replace the page-bound `useActionState` submission in `src/components/kyobo-add-book-form.tsx` with provider submission. Capture enabled form values and the current search context synchronously, register the task, and return control immediately.
- Pass a display title from `src/app/search/kyobo/[saleId]/page.tsx` when available. On revisiting a detail page, show the matching task state and restore a failed submission's options when that destination is still writable; reconcile removed shelves or folders against current destination choices.
- Keep existing destination switching rules, option defaults, ebook restrictions, and localized field errors. Disable only a matching pending submission; other page controls, destinations, and books remain usable. Provide the existing back-to-results link while pending, with no completion-time redirect.
- Add a compact status trigger and expandable panel such as `src/components/book-add-status.tsx` in the shared layout. Show the active count and per-book title, destination, indeterminate activity indicator, and terminal result. Collapsing hides details but leaves the trigger available; dismissing terminal entries removes their snapshots.
- Provide retry and return-to-form controls for failed entries, and book/library links for successful entries. Validation failures can be corrected in the restored form; authentication failures provide a sign-in link instead of repeatedly retrying an expired session.
- Use a non-modal region or popover with no backdrop or focus trap, keyboard-operable controls, `aria-expanded`, polite status announcements, and failure alerts. Keep the page interactive, avoid invented percentages or import stages, and fit narrow mobile screens without horizontal overflow.
- Extend `src/lib/i18n/search.ts` with Korean and English labels for background activity, task counts, success, failure, uncertain network outcomes, retry, edit, and panel controls. Reuse existing error translations and locale context.

### 5. Verify navigation, recovery, and existing import behavior

- Move or supplement import assertions from `src/app/actions.test.ts` and `src/app/actions-kyobo-options.test.ts` with service tests. Preserve coverage for validation before retrieval, unauthorized writes, owner shelf/folder checks, authoritative metadata, duplicates, ebook handling, audit logging, and cover cleanup after save failure. Keep wrapper redirect behavior covered.
- Add route tests for authenticated success, missing authentication, rejected cross-origin requests, malformed input, mapped service errors, and cache revalidation only after successful saves.
- Update `src/components/kyobo-add-book-form.test.tsx` and add provider/panel tests using deferred fetch responses. Verify a request finishes after the originating form unmounts, independent additions complete out of order, rapid repeated submits produce one request, identity changes hide previous task data, retries preserve options, errors remain recoverable, and completion never pushes a route.
- Update `e2e/kyobo-options.spec.ts` to assert panel results instead of the old `status=added` redirect, retaining saved metadata and option checks. Add a browser test that holds the add response, follows an in-app link, uses another page control, and releases the response to confirm success appears on the current page. Verify the destination contains the saved book.
- Exercise failure and retry after navigating away, multiple additions, panel collapse/reopen, Korean and English text, and mobile overflow using deterministic fixtures. Extend the existing guarded Kyobo fixtures only if browser response interception cannot reliably exercise the required timing.
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and focused Prettier checks for changed files. Run `npx playwright test e2e/kyobo-options.spec.ts` plus any new background-add spec on desktop and mobile with `PLAYWRIGHT_DATABASE_URL` pointing to a migrated disposable database as required by `playwright.config.ts`.

## Acceptance Criteria

- Submitting a Kyobo book immediately shows a pending task, and the user can navigate and use other controls before retrieval finishes.
- Pending work and its status survive client-side route changes. Multiple different books can be added independently, and a repeated click on the same pending book/destination starts only one request.
- Every task identifies the book and destination and reaches a visible success or actionable failure. Closing the panel does not cancel the request, and completion leaves the current page and focus in place.
- A successful addition appears in the chosen library with its selected options, authoritative metadata, and audit record. Current library data refreshes without forcing navigation.
- A failed addition retains submitted values for retry or correction after returning to its form. Authentication and uncertain network failures have clear recovery paths; requests are never retried automatically.
- The status interface works with keyboard navigation, screen-reader announcements, Korean and English locales, and mobile layouts.
- Existing permission, validation, duplicate, transaction, cover-cleanup, and manual-entry behavior continues to pass relevant checks.

## Risks And Decisions

- Background means work continues during in-app navigation in the open tab. A root-layout provider plus a normal HTTP request meets that scope with no job infrastructure. Full reloads or closed tabs lose in-memory status and may leave the save outcome unknown; persistent recovery would require a separate durable-job design.
- A route handler avoids coupling slow imports to Server Action dispatch. Extracting one shared service prevents the new endpoint and compatibility action from drifting apart.
- Progress is indeterminate because the existing import function does not report stages. Pending and terminal states communicate real information without adding a streaming protocol.
- Keep server-side duplicate checks and add a per-session client guard. The existing check-before-create race across separate tabs or users remains a known limit; do not promise database-wide exactly-once delivery.
- Retain snapshots only until terminal entries are dismissed or the user session changes. Use a fallback product label for direct detail URLs that lack preview data, and never trust that label as saved metadata.
- Browser tests must use client-side links when proving navigation survival; `page.goto()` reloads the document and exercises a different lifetime. Preserve the existing disposable-database requirement and test-only fixture guards.
