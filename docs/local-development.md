# Local development

- [Local development](#local-development)
  - [Container workspace](#container-workspace)
  - [Host development](#host-development)

## Container workspace

When running Node.js inside the development workspace container, use a separate development database on the workspace's Docker network:

```bash
docker compose -f docker-compose.dev-db.yml up -d --wait
```

This creates the `my-library-dev` Compose project with its own persistent `my-library-dev_postgres` volume. It does not publish a database port. The default external network is `my-library-workdir_default`; set `DEV_DOCKER_NETWORK` when the workspace uses another network. Use a network shared only by development containers so the development database stays isolated from deployed applications.

Set these values in the ignored `.env` file, keeping the existing `SESSION_SECRET` and other settings:

```dotenv
DATABASE_URL=postgresql://library:library@library-dev-db:5432/library_dev?schema=public
COVER_STORAGE_PATH=./covers
BOOK_FILE_STORAGE_PATH=./book-files
```

Apply migrations, optionally load development data, and start Next.js:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Stop the database with `docker compose -f docker-compose.dev-db.yml stop`. Its volume persists between runs. Use a separate disposable database for browser tests.

## Host development

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
