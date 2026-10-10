# Local development

Use the development override to expose only PostgreSQL from Compose, then run Next.js on the host. Keep `SESSION_SECRET` and `ALLOWED_DEV_ORIGINS` in `.env`, and override the container-oriented database and cover paths for host commands:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm ci
npm run db:generate
export DATABASE_URL=postgresql://library:library@127.0.0.1:5432/library?schema=public
export COVER_STORAGE_PATH=./data/covers
export BOOK_FILE_STORAGE_PATH=./data/books
npm run db:migrate
npm run dev
```

Optional development data:

```bash
npm run db:seed
```

The development seed creates user `reader` with password `library-demo-password`. It exits without changes when `NODE_ENV=production`.
