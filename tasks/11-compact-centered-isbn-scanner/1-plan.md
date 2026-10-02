# Make the mobile ISBN scanner compact and viewport-centered

## Goal

Reduce the barcode camera preview further on Android and ensure the scanner dialog is centered against the visible viewport instead of inheriting positioning behavior from the blurred site header.

## Confirmed scope and behavior

- Keep the scanner available only from the existing mobile header camera button and preserve ISBN detection, selected search source, navigation, localization, camera cleanup, and the icon-only close action.
- Reduce the current `clamp(8rem,32dvh,12rem)` video height to a compact responsive range suitable for Pixel 7 portrait and short Android landscape viewports. Keep enough camera area to align a barcode, but cap the portrait preview below the current 192px maximum.
- Center the complete scanner panel horizontally and vertically in the visible viewport when it fits. If browser chrome, landscape orientation, accessibility text sizing, or a camera error makes the panel taller than the available viewport, keep the overlay scrollable and all controls reachable rather than clipping the top or bottom.
- Render the dialog outside the `#site-header` backdrop-filter containing block. The header uses `backdrop-blur`, which can make fixed descendants position relative to the header on mobile browsers; the overlay must instead be attached at the document body level and cover the viewport.
- Preserve the existing dialog semantics, localized heading, status/error announcements, autofocus close button, 40px minimum close target, paper/rust/moss visual language, and `z-50` stacking behavior.
- Do not change camera constraints, barcode parsing, search URLs, desktop header layout, Kyobo search behavior, or introduce a modal package.

## Implementation

1. Update `src/components/header-search.tsx` to render `#header-scanner-dialog` through React DOM `createPortal` into `document.body` when the scanner is open. Keep the dialog state and `IsbnScanner` callbacks in `HeaderSearch`, and avoid rendering or accessing the portal target during server rendering.
2. Make the portaled overlay explicitly cover the dynamic viewport and center its panel with a layout that remains scrollable for short viewports. Retain bounded outer padding and the panel's `max-w-md`, but use dynamic viewport sizing and auto margins or equivalent overflow-safe centering so Android browser chrome does not push the panel toward the header.
3. Update `src/components/isbn-scanner.tsx` to use a smaller responsive video height, targeting approximately a 96px minimum, a viewport-relative middle value near one fifth of the dynamic viewport, and a 144px maximum. Preserve full width, rounded corners, black fallback background, `object-cover`, `muted`, and `playsInline`.
4. Keep the instruction, camera-error message, spacing, and close button inside the bounded panel. Verify the reduced preview does not cause the error state or localized Korean/English text to overflow horizontally or move the close action outside the visible panel.
5. Extend `src/components/header-search.test.tsx` to prove the dialog is attached under `document.body` rather than nested beneath the header search container, remains discoverable by its localized dialog name, and closes/detects exactly as before.
6. Update `src/components/isbn-scanner.test.tsx` to assert the new compact video-height class and retained 40px close target without coupling the test to real camera APIs.
7. Extend `e2e/smoke.spec.ts` for the Pixel 7 project: open the mobile scanner, measure the video and panel, assert the reduced height cap, confirm the panel center is close to the visible viewport center when it fits, verify the close button is visible, and assert no horizontal or vertical page overflow. Mock or tolerate camera denial so CI does not require a physical camera.
8. Add a short-viewport or landscape-sized browser assertion if the Pixel 7 portrait test cannot exercise overflow-safe centering. Confirm the panel remains scrollable and the close action reachable rather than requiring an exact center when content exceeds the viewport.
9. Bump the patch version from `0.7.1` to `0.7.2` in `package.json` and `package-lock.json`. No README or deployment change is required because this is a contained responsive UI correction.

## Verification

- Run focused `HeaderSearch` and `IsbnScanner` component tests.
- Run the scanner Playwright case in the Pixel 7 project with camera access denied or mocked; verify portrait centering, compact preview height, reachable close control, and no overflow, then repeat with a short viewport if added.
- Manually verify on Android Chrome that opening the camera from the two-row mobile header centers the panel in the visible screen rather than within the header, and that browser address-bar expansion/collapse does not restore the oversized preview.
- Manually verify Korean and English instruction/error text, close-button autofocus, successful ISBN navigation, and camera-stream cleanup on close.
- Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` when the configured PostgreSQL service is available.

## Acceptance criteria

- On Pixel 7 and Android Chrome, the scanner panel is centered in the visible viewport when its content fits and is not positioned relative to the blurred site header.
- The camera preview is visibly shorter than the current implementation and never exceeds the planned compact maximum while retaining a usable barcode target area.
- Short viewports and camera-error states keep the heading, preview, messages, and close action reachable without horizontal page overflow or clipped panel content.
- Opening, closing, camera cleanup, ISBN detection, source preservation, localized accessible names, autofocus, and navigation remain unchanged.
- Desktop header/search layout is unchanged, no modal dependency is added, and static, unit, build, and deterministic mobile browser checks pass at version `0.7.2`.

## Out of scope

- Do not redesign the header, add torch/camera selection controls, change barcode formats or camera constraints, alter search routing, add pinch/zoom behavior, or restyle unrelated dialogs.
