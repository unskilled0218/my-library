# Implemented global header search

## Version

- `0.3.0`

## Changes

- Added a responsive global header GET search for normal signed-in users and
  anonymous visitors while keeping administrator navigation separate.
- Added `/search` with authenticated `all`, `library`, and `kyobo` source
  handling, anonymous Kyobo-only enforcement, bounded authorized library
  results, independent provider errors, and selected Kyobo detail review.
- Added owner/editor destination selection for Kyobo and manual additions;
  viewer and inaccessible libraries are excluded while existing server action
  authorization remains authoritative.
- Refactored ISBN scanning to a callback API with a rear-camera preference,
  normalized barcode handling, mobile-only header entry point, and cleanup on
  detection, close, startup failure, or unmount.
- Replaced per-library Kyobo search with an access-checked redirect that
  preserves search context, and removed the library header entry point.
- Added unit/component coverage for source normalization, access-constrained
  query construction, header variants, control order, retained values, and
  scanner navigation. Extended browser smoke assertions for the new header.

## Verification

- `npm run format:check` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm test` passed: 9 files, 27 tests.
- `npm run build` passed.
- `npm run db:migrate` was blocked by `P1001`: PostgreSQL is unavailable at
  `db:5432`.
- `npm run test:e2e` was blocked before test execution because root-owned
  `.next/dev` files prevent the development server lock from being created.
  A production-server retry was also blocked at application startup by the
  unavailable PostgreSQL service.
