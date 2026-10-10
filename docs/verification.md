# Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests require a migrated test database. Live Kyobo access is not part of the normal test suite. Run the explicit diagnostic with:

```bash
npm run kyobo:probe -- 9791157107223
npm run kyobo:probe -- "너의 췌장을 먹고 싶어"
```
