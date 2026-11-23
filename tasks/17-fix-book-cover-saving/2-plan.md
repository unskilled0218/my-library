# Plan

[Scope](#scope) · [Implementation plan](#implementation-plan) · [Verification](#verification)

## Scope

Use [Kyobo product S000001750574](https://product.kyobobook.co.kr/detail/S000001750574) (ISBN `9791157107223`) to verify that its cover survives import and reopening. A planning-time HTTP request returned status 200 with an empty body. The app uses Chromium to render the page, so this check does not establish the cause.

## Implementation plan

1. Import the product into a fresh test library. An existing record skips cover download. Compare the cover visible in Chromium with the URL returned by `parseProductHtml` in `src/lib/kyobo.ts`.
2. Trace that URL through `downloadCover` in `src/lib/covers.ts`. Record the first failure: URL extraction, download, image validation, storage write, database save, or authenticated image read. `src/lib/kyobo-import.ts` currently treats a failed download as a missing cover. If storage fails, compare with a known-good image saved through `saveCoverData`.
3. Fix the first confirmed failure. If extraction fails, use the actual book-cover field from the rendered product, with a regression fixture containing only the relevant markup. Preserve host, redirect, size, and image validation, transaction cleanup, and existing behavior for genuinely unavailable covers.

## Verification

1. Add an offline regression at the failing step. Exercise the saved file and book metadata together: the stored key must resolve to image bytes with the recorded MIME type and dimensions.
2. Repeat the live import in a fresh test library. Reopen the book with browser caching disabled. Confirm `/api/covers/<coverKey>` returns the saved image and the correct cover appears on the library card and book page.
