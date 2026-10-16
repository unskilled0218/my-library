# Compact centered ISBN scanner implementation

## Changes

- Portaled the mobile ISBN scanner dialog to `document.body` so the site header's backdrop filter cannot become the fixed-position containing block.
- Changed the overlay to use the dynamic viewport height with overflow-safe auto margins, centering the scanner panel when it fits while keeping content reachable in short viewports.
- Reduced the camera preview from `clamp(8rem,32dvh,12rem)` to `clamp(6rem,20dvh,9rem)`, limiting the preview to 144px while preserving a 96px minimum target area.
- Preserved the existing dialog semantics, localization, close autofocus, camera cleanup, ISBN detection, selected search source, and navigation behavior.
- Extended component tests to verify body-level portal placement, dynamic viewport layout, compact preview sizing, and the existing close/detection behavior.
- Added a Pixel 7 Playwright case that checks preview bounds, viewport centering, short-viewport reachability, dismissal, and horizontal overflow.
- Updated the application version from `0.7.1` to `0.7.2` in `package.json` and `package-lock.json`.

## Verification

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 28 files and 105 tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm run test:e2e -- --project=mobile --grep "mobile ISBN scanner"`: could not start because PostgreSQL was unavailable at the configured `db:5432` host. Next.js exited during Prisma instrumentation before Playwright launched the test.
- Physical Android Chrome verification was not available in this environment.
