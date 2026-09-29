# Add Korean and English locales

## Goal

Add complete Korean and English presentation locales, make Korean the default, and let signed-in users persist their language from General Settings. Apply the selected language consistently to server-rendered pages, client controls, accessibility text, expected feedback, dates, and logged-out continuity without changing URLs or translating user/Kyobo content.

## Confirmed scope and behavior

- Support exactly two persisted language values: Korean (`KO`, rendered as `ko-KR`) and English (`EN`, rendered as `en`). Korean is the database, anonymous, existing-user migration, new-user, and no-cookie default.
- Add a Language setting for normal user accounts with `Korean` and `English` choices. The selection applies to that user across owned and shared libraries; it is not a library setting and does not require owner permissions.
- Resolve language in this order: signed-in user's persisted setting, valid `my_library_language` cookie, then Korean. Mirror a user's saved language into the cookie so landing/auth pages and post-sign-out/password-change pages retain the last explicit choice.
- Keep routes locale-neutral: do not add `/ko` or `/en` prefixes and do not infer English from `Accept-Language` because Korean is the requested default.
- Administrators do not receive a new persisted setting. Admin and setup pages use the valid locale cookie when present and Korean otherwise.
- Translate application-owned interface text only. Preserve login IDs, library/book/shelf names, comments, Kyobo titles/authors/descriptions/genres, imported content, audit payload values, ISBNs, and canonical URLs exactly as stored or received.
- New accounts receive Korean settings and a Korean default library name such as `내 서재`; changing language later must not rename existing user content.

## Data model and migration

1. Add a Prisma `Language` enum with `KO` and `EN`, and add `language Language @default(KO)` to `UserDisplaySettings` in `prisma/schema.prisma`.
2. Create the next timestamped migration under `prisma/migrations/`. Define the enum, add the non-null column with default `KO`, and explicitly verify that every existing `UserDisplaySettings` row is Korean after migration. Keep the default so `createUser`, seed data, and defensive settings upserts remain Korean without duplicated literals.
3. Generate Prisma types and add a migration regression test, following `src/lib/global-settings-migration.test.ts`, that checks the enum, non-null Korean default, and existing-row behavior.

## Locale infrastructure

4. Add a small typed localization layer under `src/lib/i18n/` rather than introducing a package: locale configuration and cookie constants, complete Korean and English dictionaries, locale/date/enum formatting helpers, and a server-only resolver. Make Korean the source/default dictionary and statically enforce dictionary key parity so missing English or Korean entries fail type checking/tests.
5. Keep dictionary entries semantic and grouped by feature (`common`, `auth`, `settings`, `libraries`, `books`, `search`, `transfer`, `admin`, `errors`). Support parameter interpolation and count-aware English strings without embedding React elements in dictionaries. Add presentation maps for member/access roles, reading states, ownership states, formats, audit actors/actions, and common status values while preserving their database/form values.
6. Add a root client locale provider initialized with the server-resolved language and dictionary. Client components consume this provider; server components use the server helper. Do not import `next/headers`, authentication, or database code into client bundles. Cache locale resolution per request so nested server pages do not repeat session/settings queries unnecessarily.
7. Set `<html lang>` to `ko-KR` or `en`, localize metadata through `generateMetadata`, and format dates/times with the explicit selected locale instead of environment-dependent bare `toLocaleString()` calls.

## Persistence and Settings

8. Add a dedicated `updateLanguageAction` in `src/app/actions.ts`. Require a normal user, strictly accept only `KO` or `EN`, upsert only `UserDisplaySettings.language`, set the non-sensitive `my_library_language` cookie with `SameSite=Lax`, a root path, production security settings, and a durable max age, then revalidate the root layout and redirect to or remain on Settings with localized success feedback. Keep this separate from `updateDisplayAction` so unchecked display fields cannot be changed accidentally.
9. Update sign-in to mirror the authenticated user's persisted language to the cookie, registration to establish Korean, and sign-out/password-session revocation to leave the language cookie intact. Reject malformed cookie values and fall back to Korean; never let a cookie override an authenticated database preference.
10. Add a stable `language-settings-form` panel near the top of `src/app/settings/page.tsx`, with a `language` select containing Korean and English and an explicit save action. Localize the full Settings page, including password, display, shelf tags, backup, placeholders, dynamic aria labels, errors, and success messages.

## Application localization

11. Localize `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/error.tsx`, and `src/app/not-found.tsx`: metadata, header search/account controls, anonymous landing copy, generic error/reset copy, and not-found navigation. Keep the product wordmark unchanged unless a dictionary entry intentionally supplies it.
12. Localize authentication pages and `src/components/auth-form.tsx`, including login/register/admin setup titles, labels, help text, buttons, alternates, errors, and success messages. Replace the current `title.includes(...)` autocomplete decision with an explicit form mode (`login`, `register`, or `setup`) so translating titles cannot change password autocomplete semantics.
13. Localize library and book surfaces: `src/app/libraries/page.tsx`, `src/app/libraries/[id]/page.tsx`, `src/app/libraries/[id]/settings/page.tsx`, `src/app/books/[id]/page.tsx`, `src/components/library-search-controls.tsx`, `src/components/library-book-list.tsx`, and `src/components/book-card.tsx`. Cover headings, forms, placeholders, empty states, pagination, roles, enum labels, buttons, image alt text, and aria names while leaving submitted enum values stable.
14. Localize global search and scanning: `src/app/search/page.tsx`, `src/components/header-search.tsx`, `src/components/isbn-scanner.tsx`, and `src/components/kyobo-review-modal.tsx`. Translate source choices, result grouping, provider/detail/duplicate/add feedback, destination/manual forms, mobile camera instructions, dialog labels, and the bottom add notice. Keep Kyobo result content untouched.
15. Localize statistics, audit, transfer, and administration: `src/app/libraries/[id]/stats/page.tsx`, `src/app/libraries/[id]/audit/page.tsx`, `src/app/libraries/[id]/transfer/page.tsx`, `src/components/import-panel.tsx`, and `src/app/admin/page.tsx`. Translate metric labels, enum/audit presentation, empty states, transfer summaries, admin statuses/actions, and use explicit locale-aware date formatting.
16. Inventory all remaining JSX and user-visible strings under `src/app` and `src/components` after the primary conversion. Include accessibility-only labels, placeholders, status/alert content, confirmation copy, image alt text, and singular/plural counts; do not translate internal logs, health output, canonical protocol values, or low-level exception text that users never see.

## Errors and API feedback

17. Replace expected auth/settings/mutation feedback currently transported as English prose with stable codes. Map registration/login/setup/password/language/search statuses to localized dictionary messages at the page boundary; do not render arbitrary query-string text as trusted product copy. Keep unexpected failures routed to the localized global error boundary.
18. For import preview/apply endpoints in `src/app/api/settings/transfer/route.ts` and `src/app/api/libraries/[id]/transfer/route.ts`, return stable error/status codes and structured counts where the UI displays responses. Translate those codes inside `ImportPanel`; keep machine-facing HTTP statuses and developer diagnostics language-neutral.

## Backup compatibility and documentation

19. Include language in account-level backups because it is an account preference. Introduce account backup version 2 with `settings.language`, continue accepting version 1, and preserve the importing account's current language when an old backup omits it. Do not change library-only backup version 2 because language is not library data.
20. Update `src/lib/transfer-schema.ts`, account transfer import/export, and transfer tests for v1/v2 compatibility. Ensure an imported language is validated as `KO | EN`, applied transactionally with the other account settings, and mirrored to the locale cookie only after a successful apply if the import flow can safely do so; otherwise document that the next request reads the persisted preference.
21. Update `README.md` with supported languages, Korean-default behavior, settings/cookie precedence, account backup behavior, and the fact that stored user/Kyobo content is not translated. Bump `package.json` and `package-lock.json` from `0.3.0` to `0.4.0` as a user-visible feature.

## Test plan

- Add locale configuration/resolution tests for authenticated database precedence, valid cookie fallback, malformed-cookie rejection, Korean default, locale tags, interpolation, plural behavior, enum labels, explicit date locale, and dictionary parity.
- Add migration tests proving the `Language` enum/column/default and Korean behavior for existing rows.
- Add action tests for valid Korean/English updates, invalid values, settings upsert, cookie options, root revalidation, sign-in cookie synchronization, sign-out retention, and localized stable feedback codes.
- Add account backup tests proving version 2 language round trips, version 1 remains importable, invalid language is rejected, and v1 import preserves the current preference.
- Update component tests for both languages in `header-search`, library controls/list, import panel, scanner, auth form, and Kyobo modal. Assert translated labels/aria names while form names and enum values remain unchanged, and explicitly test autocomplete by auth mode rather than title text.
- Extend `e2e/smoke.spec.ts`: Korean is the anonymous/new-account default; `<html lang>` is `ko-KR`; Settings exposes Korean/English; selecting English immediately updates the shell and principal routes; the preference survives reload/navigation/sign-out/login; a shared library uses the viewer's locale; admin behavior follows cookie/default policy; desktop/mobile layouts do not overflow with either locale.
- Keep live Kyobo and camera hardware outside normal CI. Run `npm run db:generate`, `npm run db:migrate`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and database-backed desktop/mobile `npm run test:e2e` when PostgreSQL is available.

## Acceptance criteria

- A fresh or anonymous session renders Korean throughout the application with `<html lang="ko-KR">`; no English preference is inferred automatically.
- Signed-in users can choose Korean or English in General Settings, see the change immediately, and retain it across all owned/shared routes, reloads, sign-out, and later sign-in.
- Every application-owned visible string on normal-user, anonymous, and administrator surfaces has Korean and English output, including accessibility text, enum/status labels, dates, expected errors, import feedback, and responsive search/scanner dialogs.
- User-generated and Kyobo-provided content is never translated or mutated by a locale change, and persisted/form/API enum values remain stable.
- Existing users migrate to Korean, new users default to Korean, account backup v2 preserves language, and old account/library backups remain compatible.
- Both locales remain usable on desktop and mobile, with passing static checks, unit/component tests, production build, migrations, and database-backed browser tests where infrastructure is available.
