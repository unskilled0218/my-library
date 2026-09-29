# Replace header search text with icons

## Goal

Simplify the compact global search UI by replacing the visible Search and mobile Scan button text with familiar icons while preserving localized accessible names, existing behavior, and comfortable pointer and touch targets.

## Confirmed scope and behavior

- Limit this change to the submit and ISBN camera controls in `src/components/header-search.tsx`, where text competes with the query and source controls for header width.
- Keep the query input, signed-in source selector, anonymous Kyobo label, scanner dialog, and all other application actions unchanged.
- Use a magnifying-glass icon for search and a camera icon for scanning. Keep both buttons as semantic `button` elements with their existing IDs and types.
- Preserve localized accessible names with `common.search` and `messages.scanIsbn`; icons are decorative and hidden from assistive technology.
- Do not add an icon package or a shared icon-button abstraction for two one-off controls. Use small inline SVGs with consistent stroke, sizing, and `currentColor` so they follow existing button states.

## Implementation

1. Update `src/components/header-search.tsx` so `#header-search-submit` renders only a magnifying-glass SVG and has `aria-label={common.search}`. Replace the visible `messages.scan` content in `#header-isbn-camera` with a camera SVG while retaining its existing `aria-label={messages.scanIsbn}`, mobile-only visibility, click handler, and secondary-button treatment.
2. Give both icon buttons explicit square dimensions and zero horizontal padding while retaining the global 40px minimum control size, rounded shape, hover state, focus ring, and disabled behavior. Keep SVGs at a consistent visual size and add `aria-hidden="true"` plus `focusable="false"` so they do not alter the accessible name or keyboard order.
3. Do not remove the underlying Korean or English dictionary entries: `common.search` and `messages.scanIsbn` remain required accessibility copy, and `messages.scan` may still be useful outside this focused change. Do not alter search submission, source retention, anonymous Kyobo enforcement, scanner navigation, or responsive breakpoints.
4. Update `src/components/header-search.test.tsx` to verify the Korean and English Search and Scan controls remain discoverable by their localized accessible names, contain decorative SVG icons, and no longer expose their former visible text. Retain the existing control-order, mobile visibility, dialog, and scanned-ISBN navigation assertions.
5. Extend the relevant header assertions in `e2e/smoke.spec.ts` only where needed to confirm the icon controls remain usable by accessible name and that the compact header does not overflow at the existing desktop and mobile viewport coverage. Continue using stable IDs for layout-specific checks.
6. Bump the application patch version from `0.4.0` to `0.4.1` in `package.json` and `package-lock.json` for the user-visible UI refinement; no README change is required because search behavior and documented capabilities do not change.

## Verification

- Run the focused `HeaderSearch` component tests and relevant desktop/mobile Playwright smoke cases.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- Manually verify that both controls remain at least 40 by 40 pixels, keyboard focus is visible, Korean and English accessible names are announced, the camera control remains mobile-only, and the header has no horizontal overflow at Pixel 7 and desktop widths.

## Acceptance criteria

- The global header shows a magnifying-glass button instead of visible Search text in both locales and a camera button instead of visible Scan text on mobile.
- Assistive technology and role-based tests identify the controls as localized Search and Scan ISBN buttons; the SVGs do not add duplicate or misleading names.
- Search submission, source selection, anonymous restrictions, scanner opening/closing, and scanned-ISBN navigation behave exactly as before.
- Icon buttons retain clear hover and keyboard-focus feedback, meet the existing minimum touch target, and reduce header width without desktop or mobile overflow.
- No new runtime dependency, reusable abstraction, broad button conversion, or unrelated UI change is introduced, and all static checks, tests, and production build pass.
