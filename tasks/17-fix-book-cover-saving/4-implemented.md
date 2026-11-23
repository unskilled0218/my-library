# Saved book covers

[Changes](#changes) · [Verification](#verification)

## Changes

Added the missing `/api/covers/[key]` reader. It checks library access before reading the file and serves the stored MIME type without shared caching. Git now tracks the route while ignoring stored images. Updated the release metadata to 0.7.11.

## Verification

- Before the fix, a fresh import of [S000001750574](https://product.kyobobook.co.kr/detail/S000001750574) saved a 63,701-byte JPEG. Chromium found the correct Kyobo image, but the signed-in cover request returned 404.
- After the fix, another fresh import returned HTTP 200 with the exact stored bytes. With caching disabled, the library card and reopened book page both decoded the image at its recorded 400 × 604 dimensions.
- The browser regression imported a known PNG through library transfer, compared served bytes and MIME type, and checked anonymous and nonmember requests returned 404. It passed using the workspace Playwright 1.64 client and remote Chromium; the repository's 1.63 client cannot connect to that service.
- Type checking, focused ESLint, 26 Kyobo tests, and release configuration validation passed. Live and offline browser checks used a disposable PostgreSQL database.
