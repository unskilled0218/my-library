# Build the my-library MVP

## Goal

Build a responsive personal book-management web application where users can register, sign in, manage their own libraries and books, share libraries with other registered users, and add books through Kyobo search or ISBN scanning. Include a minimal administrator view for user management and keep external scraping isolated from the core application.

## Technical direction

- Use Next.js with the App Router, TypeScript, React, and server-side route handlers/actions so the application runs on port 3000 in the existing Node container.
- Use PostgreSQL with Prisma for persistent relational data; add a database service and persistent volume to the workspace Docker Compose configuration, and provide an example environment file for connection and session secrets.
- Use Auth.js credentials authentication with database-backed users and sessions. Hash passwords with a supported password-hashing library and never expose password hashes through application DTOs.
- Use Tailwind CSS for a mobile-first responsive interface, with accessible form controls, keyboard navigation, loading states, empty states, and error feedback.
- Use Vitest and Testing Library for unit/component tests and Playwright for critical browser flows.

## Data model

- Add `User` with an immutable ID, unique normalized login ID, password hash, role (`USER` or `ADMIN`), timestamps, owned libraries, shared memberships, and sessions.
- Add `Library` with ID, owner, name, description, timestamps, memberships, books, location tags, and display settings. Creating a user should also create a default library transactionally.
- Add `LibraryMember` with a unique library/user pair and role (`VIEWER` or `EDITOR`). Owners retain all permissions and cannot be represented as removable memberships.
- Add `Book` scoped to one library with title, authors, genre, cover URL, ISBN-10/ISBN-13 where available, ownership state, format (`PHYSICAL` or `EBOOK`), reading state (`NOT_STARTED`, `READING`, or `DONE`), optional location tag, personal comment, source metadata, and timestamps.
- Add `LocationTag` scoped to a library. Prevent deletion while in use unless the user explicitly reassigns or clears affected books.
- Add `LibraryDisplaySettings` with default view (`LIST` or `GRID`) and booleans for the metadata shown on the main list.
- Define indexes and uniqueness constraints for normalized login IDs, memberships, library book searches, ISBN lookup, and location names within a library.

## Implementation steps

1. Bootstrap the Next.js TypeScript application and project tooling. Add linting, formatting, type checking, unit-test, browser-test, database migration, and seed commands. Document local startup through the existing Docker Compose workflow.
2. Add PostgreSQL to Docker Compose, environment validation, Prisma schema, initial migration, and a development seed containing one admin and representative libraries/books without committing real credentials.
3. Implement registration, sign-in, sign-out, session protection, and role checks. Validate inputs server-side, normalize login IDs consistently, enforce a reasonable password policy, return generic authentication errors, and add basic rate limiting to registration and sign-in endpoints.
4. Centralize authorization helpers for library read/write access and admin access. Apply them in every server action and route handler so client-supplied library, user, book, or membership IDs cannot cross tenant boundaries.
5. Implement library CRUD and sharing. Owners can rename/delete libraries, add registered users by login ID, choose viewer/editor access, change access, and revoke it; members can see shared libraries, while only editors can mutate books and settings.
6. Implement book CRUD and the main library view. Support list/grid switching, persisted display preferences, pagination, search across title/author/genre/ISBN/comment, filters for ownership/format/reading state/location, and responsive book detail/edit screens.
7. Implement location-tag settings and validate that a location can only be assigned to a physical book in the same library. Make destructive operations explicit and preserve referential integrity.
8. Create a server-only `BookSearchProvider` interface and a Kyobo implementation. Fetch Kyobo pages/endpoints with timeouts, a descriptive user agent, bounded retries, response-size limits, parsing validation, and short-lived caching; map external responses into an internal candidate type so scraper changes remain localized.
9. Add keyword search and ISBN lookup screens. Let users review and edit imported metadata before saving, detect likely duplicates by normalized ISBN within the selected library, and provide a manual-entry fallback whenever Kyobo is unavailable or incomplete.
10. Add mobile ISBN scanning using the device camera. Prefer the browser `BarcodeDetector` API when available and use a maintained client-side fallback for unsupported browsers; require camera permission only after user interaction, stop media tracks on close/navigation, and allow typed ISBN entry at all times.
11. Add a minimal admin area protected by server-side role checks. List/search users, inspect account and library counts, enable/disable accounts, and prevent an administrator from disabling the final active administrator. Do not expose password hashes or personal book comments.
12. Polish navigation and operational behavior: desktop/mobile layouts, loading and not-found states, structured server logging without secrets, a health endpoint that checks application and database readiness, metadata, and clear handling for offline/external-provider failures.

## Test plan

- Unit-test validation, login-ID normalization, ISBN normalization, permission decisions, book-search mapping/parsing, duplicate detection, and location/format invariants.
- Integration-test registration/default-library creation, authentication, library ownership and sharing roles, cross-user access denial, book CRUD, settings persistence, tag deletion rules, account disabling, and transaction rollback behavior against a test database.
- Mock Kyobo responses for parser contract tests, including valid results, changed/missing markup, timeout, rate limiting, malformed data, and no-result cases. Do not make live Kyobo requests in the normal test suite.
- Component-test important forms, filters, list/grid preferences, accessible error messages, and camera/manual-entry fallbacks.
- Add Playwright flows for registration and sign-in, creating and sharing a library, editor versus viewer permissions, adding/editing/searching a book, changing display settings, and administrator access control at desktop and mobile viewport sizes.
- Run formatting, linting, type checking, unit/integration tests, a production build, and browser tests before considering the task complete.

## Acceptance criteria

- A new user can register without verification, sign in, and receive a private default library.
- Users can create, edit, and delete their own libraries and can share them with another registered user using explicit viewer/editor permissions.
- Owners and editors can manage books; viewers can only read them; unauthorized users cannot discover or mutate another user's data by changing request identifiers.
- Books support the requested metadata, ownership and reading states, physical/ebook distinction, physical location tags, and personal comments.
- The main library supports internal search, filters, list/grid layouts, and per-library display preferences on desktop and mobile.
- Users can search Kyobo by keyword, look up or scan an ISBN, review the candidate, and add it, with manual entry available if lookup or camera access fails.
- Administrators can access the protected user-management screen, while regular users cannot.
- The app and database start from the documented Docker Compose commands, migrations can initialize an empty database, and no secret or generated runtime data is committed.

## Out of scope

- Email verification, password reset, social login, public libraries, lending workflows, recommendations, ratings, native mobile applications, and image hosting are deferred.
- Automated circumvention of Kyobo anti-bot protections is not permitted. If stable access cannot be implemented within Kyobo's terms and technical constraints, retain the provider boundary and ship manual entry plus ISBN validation while documenting the limitation.

## Follow-up suggestions

- Add CSV/JSON import and export so users can back up or migrate personal collections.
- Add audit history for sharing and destructive actions before expanding administrator capabilities.
- Add optional lending records, reading dates, ratings, and statistics only after the core ownership and permission flows are stable.
