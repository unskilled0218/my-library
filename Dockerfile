# syntax=docker/dockerfile:1

FROM node:24-bookworm AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM dependencies AS builder

COPY next-env.d.ts next.config.ts postcss.config.mjs tailwind.config.ts tsconfig.json ./
COPY src ./src
RUN npm run db:generate && npm run build

FROM node:24-bookworm AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm AS runtime

ARG BUILD_VERSION=development
ARG BUILD_REVISION=unknown
ARG BUILD_SOURCE=https://git.lan/dev/my-library

LABEL org.opencontainers.image.title="My Library" \
  org.opencontainers.image.source="$BUILD_SOURCE" \
  org.opencontainers.image.revision="$BUILD_REVISION" \
  org.opencontainers.image.version="$BUILD_VERSION"

ENV NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT=3000 \
  PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  COVER_STORAGE_PATH=/app/data/covers \
  BOOK_FILE_STORAGE_PATH=/app/data/books

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
RUN npx playwright install --with-deps chromium \
  && npm cache clean --force

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod 755 /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p "$COVER_STORAGE_PATH" "$BOOK_FILE_STORAGE_PATH" \
  && chown -R node:node /app/data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
