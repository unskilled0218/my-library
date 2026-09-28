# Separate global and library settings

## Goal

Replace the signed-in header's `Libraries` button with a global `Settings` destination for account password, shared shelf tags, and a shared library-view preference. Add one `Settings` button inside each library and move library-specific sharing, ownership, import/export, audit log, and statistics access out of the library collection page.

## Confirmed decisions

- Shelf tags and library-view settings are global to an account rather than configured independently for each library.
- A user's library-view preference applies consistently while that user views any owned or shared library.
- A user's shelf tags are shared by every library they own. Members editing somebody else's library use that library owner's shelf tags, preserving one authoritative physical-location vocabulary for each collection owner.
- The account section supports changing the password; the login ID remains immutable.
- `Audio log` in the request means the existing owner-only `Audit log`.
- Existing role boundaries remain unchanged: readers can see statistics, owners can manage sharing/library ownership details/import/export/audit, and editors do not gain owner-only access.

## Data model and migration

1. Replace per-library `LibraryDisplaySettings` with a one-to-one user preference model containing the existing default view and visibility flags. Relate it to `User`, create defaults with each new user, and stop creating settings when a library is created.
2. Change `LocationTag` ownership from `libraryId` to `userId`, retain the `Book.locationTagId` relation, and enforce unique shelf-tag names per user. A book may reference only a tag belonging to its library owner; enforce this invariant in application mutations and imports because the database relation alone cannot express it.
3. Add a Prisma migration that preserves persisted data. Build each owner's global display preference from that owner's earliest-created library settings, default users without owned-library settings, union same-named shelf tags across all libraries owned by the same user, repoint every book to the migrated owner tag with the same name, and only then remove the obsolete per-library settings and tag ownership columns. Use deterministic ordering and conflict handling so duplicate names from separate libraries collapse without losing book assignments.
4. Update seeds, user registration, library creation, generated Prisma types, and any fixtures for the new relations. Document that display settings are viewer-specific while shelf tags are library-owner-specific.

## Global settings

5. Add an authenticated `/settings` server page with stable IDs and three focused panels: Account, Shelf tags, and Library view. Replace only the signed-in user's `Libraries` header link in `src/app/layout.tsx` with a `Settings` link immediately left of `Sign out`; keep the logo as the route back to `/libraries` and leave administrator navigation unchanged.
6. In Account, display the immutable login ID and add a change-password form requiring current password, new password, and confirmation. Add a rate-limited server action that verifies the current hash, applies the existing 12-128 character policy, rejects a mismatched confirmation and unchanged password, writes a bcrypt hash, revokes all user sessions, clears the current cookie, and redirects to sign-in with a non-sensitive success/error status.
7. Move shelf-tag add, rename, and delete forms from the library page to global Settings. Rewrite their actions to authorize against the current user's account-owned tags rather than a submitted library ID, reject empty/duplicate names, prevent deletion while the tag is assigned to any book, and revalidate Settings plus affected library/book routes.
8. Move the display form from the library page to global Settings. Rewrite `updateDisplayAction` to update only the authenticated user's preference, include every existing metadata checkbox and default grid/list choice, and invalidate library pages so the saved preference is used on the next load.
9. Update library and book queries to source display settings from the current viewer and shelf-tag choices from the library owner. Apply the viewer's saved display defaults to every library, expose the owner's shared tags in library filters and writable book forms, and validate that submitted location IDs belong to the library owner even when an editor performs the update.

## Library-specific settings

10. Add `/libraries/[id]/settings` and a single `Settings` button in the library header. Remove the direct Statistics, Audit log, and Import/export header buttons and remove all inline settings panels from the main library page so that page remains focused on searching, filtering, and viewing books.
11. Make the library settings page require read access and show a role-aware navigation/dashboard. Every reader can open Statistics; only the owner can open Import/export and Audit log and can see the Sharing and Ownership panels. Editors and viewers must not receive owner member data or owner-only controls.
12. Move the existing sharing member forms and library ownership/details/delete forms into the new library settings page without duplicating mutation logic. Update `updateLibraryAction`, sharing actions, and related revalidation to refresh the new settings route as well as the library/list routes.
13. Keep the existing `/libraries/[id]/stats`, `/libraries/[id]/audit`, and `/libraries/[id]/transfer` implementations and authorization, but link them from the new settings page and add consistent links back to library settings or the library. Preserve not-found behavior for inaccessible libraries and do not weaken API authorization.

## Import and export compatibility

14. Update transfer queries and writes for owner-level shelf tags. JSON and CSV exports retain each book's location name; importing into an owned library upserts those names into the owner's shared tags and assigns the resulting IDs.
15. Introduce a version-2 JSON library backup shape that omits account-wide display preferences and unused global shelf tags because a library-specific import must not overwrite settings used by every library. Continue accepting existing version-1 backups as persisted external data: migrate their library/location data and book assignments, but deliberately ignore their legacy per-library display block. Update transfer copy and validation errors to explain the boundary.

## Accessibility and UX

16. Preserve the established responsive panel/button styling and add descriptive IDs for global settings, each settings panel/form, the library Settings entry point, and library settings sections. Use explicit labels, password autocomplete values, status messaging, and destructive styling for library deletion.
17. Ensure navigation remains usable on mobile: header controls may wrap without changing their order, settings dashboards use single-column layouts before wider breakpoints, and long member/tag rows do not overflow.

## Test plan

- Add migration/integration coverage or deterministic migration assertions for merging duplicate per-library tag names, preserving book tag assignments, selecting the canonical existing display preference, and creating defaults for users without settings.
- Add action tests for password verification, password policy/confirmation, session revocation, account-level display updates, tag ownership checks, in-use deletion rejection, duplicate tag rejection, and editor assignment of an owner's valid tag.
- Add route/render tests for owner, editor, viewer, and unauthenticated access to global and library settings, ensuring owner-only data is never fetched or rendered for lower roles.
- Extend Playwright coverage to verify the global header shows `Settings` rather than `Libraries`, the logo still returns to libraries, password form fields render, shelf/view controls are global, and saved display settings apply across two libraries.
- Extend Playwright coverage to verify a library has one Settings button, the main library page no longer contains inline settings, owner links/panels are present on library settings, and lower roles see only permitted destinations.
- Add transfer tests for version-2 export/import, version-1 compatibility, owner-tag upsert and assignment, and the rule that importing a library never overwrites global display preferences.
- Run Prisma formatting/validation and migration deployment against PostgreSQL, formatting, linting, type checking, unit/integration tests, production build, and desktop/mobile Playwright tests.

## Acceptance criteria

- The signed-in global header shows `Settings` immediately left of `Sign out` and no `Libraries` button; the logo still links to `/libraries`.
- Global Settings contains immutable account identity, secure password change, one shelf-tag collection shared across all libraries owned by the user, and one display preference applied when the user views any library.
- Existing shelf-tag assignments and a deterministic existing display configuration survive migration.
- Every library page has one Settings button and no longer embeds sharing, ownership, shelf-tag, or display forms.
- Library Settings exposes Statistics to readers and exposes Sharing, Ownership, Import/export, and Audit log only to owners under existing server-side authorization.
- Editors can assign the library owner's shared shelf tags but cannot manage that owner's global settings or access owner-only library settings.
- Library transfer remains compatible with version-1 backups, exports version 2, preserves book location names, and cannot overwrite account-wide display settings.
- Password changes require the current password, enforce existing password rules, revoke existing sessions, and require the user to sign in again.
