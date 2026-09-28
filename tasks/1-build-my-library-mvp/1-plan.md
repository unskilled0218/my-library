# Build the my-library MVP

## Goal

Build a responsive personal book-management web application where users can register, sign in, manage their own libraries and books, share libraries with other registered users, and add books through Kyobo search or ISBN scanning. Include collection backup and restore, lending and reading history, ratings and statistics, auditable sensitive actions, and a minimal administrator view while keeping external scraping isolated from the core application.

## Technical direction

- Use Next.js with the App Router, TypeScript, React, and server-side route handlers/actions so the application runs on port 3000 in the existing Node container.
- Use PostgreSQL with Prisma for persistent relational data and a dedicated persistent application volume for downloaded cover images; add both services/storage locations to the workspace Docker Compose configuration and provide an example environment file for connection, session secrets, and the cover-storage path.
- Use Auth.js credentials authentication with database-backed sessions and distinct user/admin sign-in flows. Hash passwords with a supported password-hashing library and never expose password hashes through application DTOs.
- Use Tailwind CSS for a mobile-first responsive interface, with accessible form controls, keyboard navigation, loading states, empty states, and error feedback.
- Use Vitest and Testing Library for unit/component tests and Playwright for critical browser flows.

## Data model

- Add `User` with an immutable ID, unique normalized login ID, password hash, timestamps, owned libraries, shared memberships, and sessions. A user principal is always `USER`; no user record or user-facing operation can grant administrator privileges.
- Add a separate `Admin` credential and session model so administrator access cannot be obtained by changing a user's role. Admin IDs must use a namespace distinct from user login IDs.
- Add `Library` with ID, owner, name, description, timestamps, memberships, books, location tags, and display settings. Creating a user should also create a default library transactionally.
- Add `LibraryMember` with a unique library/user pair and role (`VIEWER` or `EDITOR`). Owners retain all permissions and cannot be represented as removable memberships.
- Add `Book` scoped to one library with title, authors, genre, an optional locally stored cover-image key and image metadata, a short description sourced from Kyobo's book introduction, ISBN-10/ISBN-13 where available, ownership state, format (`PHYSICAL` or `EBOOK`), reading state (`NOT_STARTED`, `READING`, or `DONE`), optional reading start/finish dates, optional integer rating from 1 to 5, optional location tag, personal comment, a required canonical source URL pointing to the Kyobo product page, and timestamps. Do not retain a remote cover URL as the display source.
- Add `Loan` as lending history for a physical book, with borrower name, lent date, optional due date, returned date, and timestamps. Enforce at most one open loan per book and retain completed loans.
- Add `LocationTag` scoped to a library. Prevent deletion while in use unless the user explicitly reassigns or clears affected books.
- Add `LibraryDisplaySettings` with default view (`LIST` or `GRID`) and booleans for the metadata shown on the main list.
- Add `AuditLog` with actor principal, action, target type/ID, a minimal non-sensitive change summary, and timestamp. Audit sharing changes, imports, library/book deletion, account status changes, and other administrator actions without storing passwords, session data, or book comments.
- Define indexes and uniqueness constraints for normalized login IDs, memberships, library book searches, ISBN lookup, and location names within a library.

## Implementation steps

1. Bootstrap the Next.js TypeScript application and project tooling. Add linting, formatting, type checking, unit-test, browser-test, database migration, and seed commands. Document local startup through the existing Docker Compose workflow.
2. Add PostgreSQL and a persistent cover-image volume to Docker Compose, environment validation, Prisma schema, initial migration, and representative development seed data without fixed administrator credentials or committed secrets.
3. Add an idempotent administrator bootstrap that runs after migrations and only when no `Admin` exists. If both `ADMIN_ID` and `ADMIN_PASSWORD` are set, create the initial admin from them and store only the password hash; reject partial configuration and ignore the bootstrap credentials once an admin exists. If neither variable is set, generate a short-lived, single-use setup token at first server startup, print only that token and the local setup URL to server output, and require it at `/admin/setup` to create the initial admin. Invalidate the token after successful creation, enforce creation transactionally, and disable the setup route as soon as any admin exists.
4. Implement separate user and administrator sign-in/sign-out flows, session protection, and principal checks. Validate inputs server-side, normalize login IDs consistently, enforce a reasonable password policy, return generic authentication errors, rate-limit authentication and first-run setup attempts, and never accept a client-supplied principal type.
5. Centralize authorization helpers for library read/write access and administrator access. Apply them in every server action and route handler so client-supplied library, user, book, membership, or session IDs cannot cross tenant or principal boundaries.
6. Implement library CRUD and sharing. Owners can rename/delete libraries, add registered users by login ID, choose viewer/editor access, change access, and revoke it; members can see shared libraries, while only editors can mutate books and settings.
7. Implement book CRUD and the main library view. Support list/grid switching, persisted display preferences, pagination, search across title/author/genre/description/ISBN/comment, filters for ownership/format/reading state/location, and responsive book detail/edit screens.
8. Implement location-tag settings and validate that a location can only be assigned to a physical book in the same library. Make destructive operations explicit and preserve referential integrity.
9. Create a server-only `BookSearchProvider` interface and a Kyobo implementation. Fetch Kyobo pages/endpoints with timeouts, a descriptive user agent, bounded retries, response-size limits, parsing validation, and short-lived caching; map external responses, including the candidate cover URL, into an internal type so scraper changes remain localized.
10. Add keyword search and ISBN lookup screens. Map Kyobo's short book introduction to the book description, let users review and edit imported metadata before saving, persist the canonical Kyobo product URL as the required book source URL, detect likely duplicates by normalized ISBN within the selected library, and provide a manual-entry fallback whenever Kyobo is unavailable or incomplete. Manual entry and all import formats must require and validate a Kyobo product URL. When saving a Kyobo candidate, download its cover server-side from an allowlisted Kyobo image host with redirect limits, timeouts, byte/dimension limits, content-signature validation, and generated filenames; store it in the persistent cover volume and serve it through an application-controlled route. Use a placeholder if download fails, remove newly written files if the database transaction fails, and delete unreferenced files when covers are replaced or books are permanently deleted.
11. Add mobile ISBN scanning using the device camera. Prefer the browser `BarcodeDetector` API when available and use a maintained client-side fallback for unsupported browsers; require camera permission only after user interaction, stop media tracks on close/navigation, and allow typed ISBN entry at all times.
12. Add versioned JSON export/import for lossless backup and CSV export/import for spreadsheet book workflows. Export only libraries the requester owns; JSON includes books, tags, settings, loans, ratings, reading dates, and optional base64-encoded cover files within explicit total-size limits, while CSV uses one row per book and omits settings, loan history, and cover binaries. Exclude credentials, sessions, memberships, and audit logs from both formats. Validate MIME type, size, schema, field lengths, enum values, dates, URLs, and decoded image signatures; show a dry-run summary with duplicate/conflict choices before applying an import transactionally and clean up cover files after a failed import.
13. Add lending management for physical books, including lend, return, due-date editing, current-loan visibility, overdue indication, and retained loan history. Add reading start/finish dates and ratings to book editing, keep dates consistent with reading state, and allow ratings only within the defined range.
14. Add a per-library statistics view computed from authorized library data: totals by ownership, format, reading state, genre, and location; completion trends; ratings distribution; and current/overdue loans. Provide useful empty states and avoid exposing shared-library data outside the viewer's access.
15. Record immutable audit events in the same transaction as sharing changes, imports, destructive library/book actions, user account status changes, and administrator actions. Let owners view their library audit history and administrators view system-level events, with pagination and authorization checks.
16. Add a minimal admin area protected by the separate administrator session. List/search users, inspect account and library counts, enable/disable user accounts, and review system audit events. Do not expose password hashes or personal book comments.
17. Polish navigation and operational behavior: desktop/mobile layouts, loading and not-found states, structured server logging without secrets, a health endpoint that checks application and database readiness, metadata, and clear handling for offline/external-provider failures.

## Test plan

- Unit-test validation, login-ID normalization, ISBN normalization, required canonical Kyobo source URL validation and mapping, cover mapping, image host/type/size validation, generated storage keys, permission decisions, book-search mapping/parsing, duplicate detection, import schema/version handling, CSV escaping, loan state, reading-date consistency, rating limits, statistics aggregation, audit redaction, and location/format invariants.
- Integration-test registration/default-library creation, user authentication, environment-based admin bootstrap, one-time first-start admin setup, setup-route shutdown, administrator authentication, rejection of partial bootstrap configuration, library ownership and sharing roles, cross-user access denial, book CRUD, successful and failed cover downloads, protected cover serving, orphan cleanup, settings persistence, tag deletion rules, transactional import and rollback, duplicate conflict handling, lending/return history, statistics authorization, required audit-event creation, and account disabling against a test database.
- Mock Kyobo responses for parser contract tests, including valid results, changed/missing markup, timeout, rate limiting, malformed data, and no-result cases. Do not make live Kyobo requests in the normal test suite.
- Component-test important forms, filters, list/grid preferences, accessible error messages, and camera/manual-entry fallbacks.
- Add Playwright flows for registration and sign-in, initial administrator setup, separate administrator sign-in, creating and sharing a library, editor versus viewer permissions, adding/editing/searching a book, changing display settings, JSON/CSV export and import preview, lending and returning a book, recording reading dates and a rating, viewing statistics/audit history, and administrator access control at desktop and mobile viewport sizes.
- Run formatting, linting, type checking, unit/integration tests, a production build, and browser tests before considering the task complete.

## Acceptance criteria

- A new user can register without verification, sign in, and receive a private default library.
- Users can create, edit, and delete their own libraries and can share them with another registered user using explicit viewer/editor permissions.
- Owners and editors can manage books; viewers can only read them; unauthorized users cannot discover or mutate another user's data by changing request identifiers.
- Books support the requested metadata, including Kyobo's short introduction as the description, a downloaded persistent cover image without Kyobo hotlinking, ownership and reading states, physical/ebook distinction, physical location tags, and personal comments.
- The main library supports internal search, filters, list/grid layouts, and per-library display preferences on desktop and mobile.
- Users can search Kyobo by keyword, look up or scan an ISBN, review the candidate, and add it, with manual entry available if lookup or camera access fails; every saved book has a validated canonical Kyobo product URL.
- Library owners can export a lossless JSON backup or spreadsheet-friendly CSV and safely preview/import supported files without leaking account or sharing data.
- Users can track current and completed physical-book loans, reading dates, and ratings, and can view authorized collection and reading statistics.
- Owners can review audited sharing, import, and destructive library actions; administrators can review audited system actions; sensitive credentials and comments never enter audit summaries.
- The initial administrator can be created once from complete environment credentials or through the token-protected first-start setup; the setup path cannot create another administrator afterward.
- Administrator credentials and sessions are separate from users. Every registered user remains a `USER` and cannot be promoted or use an administrator-only endpoint.
- Administrators can access the protected user-management screen, while users cannot.
- The app and database start from the documented Docker Compose commands, migrations can initialize an empty database, and no secret or generated runtime data is committed.

## Out of scope

- Email verification, password reset, social login, public libraries, recommendations, native mobile applications, and image hosting are deferred.
- Automated circumvention of Kyobo anti-bot protections is not permitted. If stable access cannot be implemented within Kyobo's terms and technical constraints, retain the provider boundary and ship manual entry requiring a valid Kyobo product URL plus ISBN validation while documenting the limitation.
