# Replace common action text with icons

## Goal

Make frequently used actions more compact and visually consistent by replacing visible Search, Scan, Settings, Filter, Grid, List, Save, Delete, and Close labels with familiar icons while preserving localized accessible names, existing behavior, and comfortable pointer and touch targets.

## Confirmed scope and behavior

- Convert the global header search and mobile ISBN scan controls in `src/components/header-search.tsx` to magnifying-glass and camera icons.
- Convert both Settings links in `src/app/layout.tsx` and `src/app/libraries/[id]/page.tsx` to a gear icon.
- Convert the library filter toggle in `src/components/library-search-controls.tsx` to a funnel icon. Use a close icon for the existing Hide filters control because it dismisses the open filter panel; do not change the panel state or query behavior.
- Convert the Grid and List view controls in `src/components/library-book-list.tsx` to their corresponding layout icons without changing their `aria-pressed` behavior.
- Convert actions whose visible localized label is Save or Delete, including qualified variants such as Save book, Save library, Delete book, and Delete library, in `src/app/settings/page.tsx`, `src/app/books/[id]/page.tsx`, and `src/app/libraries/[id]/settings/page.tsx`. Do not convert semantically different actions such as Add, Change password, Remove member, Import, or Export.
- Convert the scanner Close camera button in `src/components/isbn-scanner.tsx` and the Kyobo review Close link in `src/components/kyobo-review-modal.tsx` to a close icon while preserving autofocus, link navigation, Escape handling, and backdrop dismissal.
- Keep every control as its current semantic `button` or `Link`, and retain IDs, types, form actions, handlers, pressed/expanded state, responsive visibility, variants, and destructive colors.
- Preserve localized accessible names using the existing message for each action. Icons are decorative and hidden from assistive technology; contextual labels such as `Delete {tag name}` remain contextual.
- Do not add an icon package. Add a small shared icon module for the repeated inline SVG treatment rather than duplicating SVG markup across all affected files. Icons use consistent sizing, stroke, and `currentColor` so they follow existing control states.

## Implementation

1. Add a focused shared icon module under `src/components/` containing magnifying-glass, camera, gear, filter, grid, list, save, delete, and close SVG components. Give every SVG a consistent view box and visual size, `aria-hidden="true"`, `focusable="false"`, and `currentColor`; keep accessibility responsibility on the containing control.
2. Update `src/components/header-search.tsx` so `#header-search-submit` and `#header-isbn-camera` render only their icons and expose `aria-label={common.search}` and `aria-label={messages.scanIsbn}`. Preserve search submission, source retention, anonymous Kyobo enforcement, scanner navigation, and the camera button's mobile-only visibility.
3. Update the global `Settings` link in `src/app/layout.tsx` and `#library-settings-link` in `src/app/libraries/[id]/page.tsx` to render the gear icon and use their existing localized Settings text as `aria-label` values.
4. Update `src/components/library-search-controls.tsx` so `#library-filter-toggle` uses the filter icon with the localized Filter accessible name and `#library-hide-filters` uses the close icon with the localized Hide filters accessible name. Preserve `aria-expanded`, `aria-controls`, form submission, active filter values, and show/hide behavior.
5. Update `src/components/library-book-list.tsx` so `#library-grid-view` and `#library-list-view` use grid and list icons with their existing localized labels supplied through `aria-label`. Preserve active styling, `aria-pressed`, initial view selection, and client-side switching.
6. Replace visible Save and Delete text with save and trash icons in `src/app/settings/page.tsx`, `src/app/books/[id]/page.tsx`, and `src/app/libraries/[id]/settings/page.tsx`. Add localized `aria-label` values from the exact text each control previously displayed, retain the shelf tag name in rename/delete accessible names, and preserve red destructive styling for book and library deletion.
7. Update `src/components/isbn-scanner.tsx` and `src/components/kyobo-review-modal.tsx` so their close controls render only the close icon and use `messages.closeCamera` or `common.close` as the accessible name. Preserve the scanner's full-width layout unless an icon-sized control can be positioned without reducing clarity, and keep the modal close link's initial focus and navigation behavior.
8. Apply a consistent icon-control treatment: explicit square dimensions, zero horizontal padding, at least the existing 40px minimum target, rounded shape, hover state, visible focus ring, and disabled behavior. Allow context-specific layout classes where a control must remain full width or align with an input, and do not rely on color alone to communicate selected or destructive state.
9. Update `src/components/header-search.test.tsx`, `src/components/library-search-controls.test.tsx`, `src/components/library-book-list.test.tsx`, and `src/components/kyobo-review-modal.test.tsx` to verify controls remain discoverable by localized accessible name, contain decorative SVG icons, expose no former visible label, and retain expanded/pressed/navigation behavior. Add focused coverage for `IsbnScanner` if needed to verify its close control without coupling tests to camera startup internals.
10. Extend `e2e/smoke.spec.ts` to exercise the Settings, Filter, Grid/List, Save/Delete, and Close icon controls already encountered by the smoke flow. Continue locating controls by accessible role/name for behavior and by stable ID only for layout checks; verify compact controls do not introduce desktop or mobile overflow.
11. Bump the application patch version from `0.4.0` to `0.4.1` in `package.json` and `package-lock.json` for the user-visible UI refinement. No README change is required because application behavior and documented capabilities do not change.

## Verification

- Run the focused tests for `HeaderSearch`, `LibrarySearchControls`, `LibraryBookList`, `KyoboReviewModal`, and any added `IsbnScanner` coverage, plus the relevant desktop/mobile Playwright smoke cases.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- Manually verify every icon control in Korean and English: its localized name is announced, its purpose is visually recognizable, keyboard focus is visible, and the target is at least 40 by 40 pixels.
- Manually verify Filter expanded state, Grid/List selected state, destructive Save/Delete distinction, scanner and Kyobo modal closing, the camera control's mobile-only behavior, and header/library layouts at Pixel 7 and desktop widths.

## Acceptance criteria

- Search, Scan, Settings, Filter, Grid, List, Save, Delete, and Close actions in the confirmed scope display the corresponding icon instead of visible action text in both locales.
- Assistive technology and role-based tests identify every control by its localized action name; contextual Delete labels still include the affected shelf tag, and decorative SVGs add no duplicate or misleading names.
- Search, filtering, view switching, settings navigation, form submission, destructive actions, scanner handling, and modal dismissal behave exactly as before.
- Icon controls retain clear hover, selected/expanded where applicable, destructive, and keyboard-focus feedback; all meet the existing minimum touch target without desktop or mobile overflow.
- No new runtime dependency or unrelated button conversion is introduced, the shared icon module remains limited to presentation, and all static checks, tests, and the production build pass.
