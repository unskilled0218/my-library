# My Library

- [Features](#features)
- [Quick start](#quick-start)
- [Documentation](#documentation)

A responsive personal book-management service for private and shared libraries, built with Next.js, React, and PostgreSQL.

## Features

- Kyobo book search/import, nested folders, hierarchical genres, and shelf tags.
- Protected local cover and EPUB/PDF storage, reading history, and statistics.
- Library sharing, JSON/CSV backups, and a separate administrator realm.
- Korean (default) and English interfaces with account-level preferences.
- Background Kyobo additions with progress, retained retry options, and continued in-app search within the open tab.

## Quick start

1. Copy `.env.example` to `.env` and set `SESSION_SECRET` to at least 32 random characters.
2. Authenticate with `docker login git.lan` if the release image is private. The Docker host must trust the registry's certificate authority.
3. Start the services:

   ```bash
   docker compose pull
   docker compose up -d
   ```

4. Wait for the app to become healthy, then open <http://localhost:3000>. Check `docker compose logs app` for the first administrator setup URL, or configure `ADMIN_ID` and `ADMIN_PASSWORD` before startup.

## Documentation

- [Production deployment, backups, and upgrades](docs/production-deployment.md)
- [Local development](docs/local-development.md)
- [Publishing a release](docs/publish-a-release.md)
- [Verification and Kyobo diagnostics](docs/verification.md)
- [Background book additions](docs/background-book-additions.md)
- [Language preferences](docs/languages.md)
- [Settings and backup scope](docs/settings-scope.md)
- [Security boundaries](docs/security-boundaries.md)
