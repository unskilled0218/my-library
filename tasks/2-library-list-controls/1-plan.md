# Improve library list and book controls

## Goal

Move library creation before the library cards and make the book-library controls behave predictably: searching must use a clear search row, filters must be hidden behind a temporary disclosure menu, and list/grid changes must update only the book layout without navigation, refresh, or scroll movement.

## Current behavior

- `src/app/libraries/page.tsx` renders the create-library form after the library-card grid.
- `src/app/libraries/[id]/page.tsx` renders search and every filter in one always-visible GET form whose submit button is labeled `Filter`.
- The list/grid controls are Next.js links that change the `view` query parameter. This performs a server navigation, refreshes the page content, and restores scroll to the top.
- Book filtering is correctly performed on the server from the current URL query, and pagination links preserve that query. Keep this server-side filtering behavior.

## Implementation steps

1. Move the existing create-library form in `src/app/libraries/page.tsx` so it appears immediately after the `Your libraries` heading block and before the library-card grid. Preserve the current server action, fields, validation, and responsive form layout; adjust vertical spacing so the form and card grid remain visually distinct.
2. Extract the library search and filter form into a focused client component, for example `src/components/library-search-controls.tsx`. Pass the current query values, location tags, and genre options from the server page rather than fetching them again on the client.
3. Render the keyword input and a submit button labeled `Search` in one horizontal row at all supported widths where space permits, with sensible mobile wrapping if necessary. Keep the form as a GET submission so the existing server-side title, author, genre, description, ISBN, and comment search remains authoritative.
4. Add a `Filter` disclosure button beside or directly below the search row. Filters for reading state, format, ownership, location, and genre must be hidden on initial render.
5. Manage filter visibility with component-local state only. Clicking `Filter` reveals the filter controls directly below the search row; clicking a visible `Hide filters` button collapses them. Do not persist disclosure state in the URL, database, local storage, or session storage, so leaving or refreshing the library page resets the menu to hidden.
6. Keep filter inputs inside the same GET form as the search input so clicking `Search` submits the keyword and currently selected filter values together. Preserve current query values as defaults after a submitted search and keep pagination links carrying the active search/filter query.
7. Extract the list/grid selector and rendered book collection into a client component, for example `src/components/library-book-list.tsx`. Initialize its local view state from the library display setting supplied by the server and render the existing `BookCard` components from serializable book/display props.
8. Replace the list/grid links with `type="button"` controls that update only local view state. Do not call `router.push`, `router.replace`, `refresh`, a server action, or `window.scrollTo`; do not update the `view` query parameter. Switching view must preserve the current URL, search/filter results, pagination state, component state, and scroll position while changing only the collection layout and selected-button styling.
9. Remove `view` from the library page search-parameter contract and from generated pagination URLs. Keep the persisted `LibraryDisplaySettings.defaultView` as the initial layout after a page load; the existing settings form remains the way to change that persisted default.
10. Preserve and extend the stable HTML IDs used for discussion and tests. Assign descriptive IDs to the create-library form, search row, search input, search button, filter toggle, filter panel, hide button, view controls, and book-list container; ensure repeated book cards retain their entity-based IDs.
11. Keep keyboard and screen-reader behavior explicit: disclosure controls use `aria-expanded` and `aria-controls`, the filter panel has a stable ID, grid/list buttons expose pressed state with `aria-pressed`, and every button has an unambiguous accessible name.

## Test plan

- Add component tests with Testing Library for the search/filter client component: filters are hidden initially, `Filter` reveals them, `Hide filters` collapses them, current query values populate the controls, and the disclosure state resets after unmount/remount.
- Add component tests for the book-list client component: it starts from the supplied default view, grid/list clicks change the layout and `aria-pressed` state, and clicking them does not mutate the URL or call navigation/refresh/scroll APIs.
- Update the Playwright flow to assert the create-library form appears before the library-card container and that the search input and `Search` button share the search row.
- Add a Playwright assertion that opens and hides the filter menu, then reloads the page and confirms filters return to hidden.
- Add a Playwright assertion that records the current URL and scroll position, switches grid/list views, and confirms both remain unchanged while the book-list layout changes.
- Run formatting, linting, type checking, unit/component tests, the production build, and database-backed Playwright tests when PostgreSQL is available.

## Acceptance criteria

- The create-library form is directly below `Your libraries` and above all library cards.
- Library book search has a keyword input and `Search` button presented as one row.
- Filters are hidden by default, appear below the search row after clicking `Filter`, remain visible during client-side interaction, and can be collapsed with `Hide filters`.
- Refreshing or leaving the library page resets the filter menu to hidden without clearing submitted filter values from the URL.
- Grid/list controls change only the rendered book layout. They do not navigate, refresh server data, alter the URL, or move the page scroll position.
- A freshly loaded library uses its persisted default view, and changing the persisted default remains available through library display settings.
- Existing server-side search, filter, authorization, book cards, pagination, and responsive behavior continue to work.
