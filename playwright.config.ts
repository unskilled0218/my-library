import { defineConfig, devices } from '@playwright/test'

const databaseUrl = process.env.PLAYWRIGHT_DATABASE_URL
if (
  !databaseUrl ||
  ['library', 'library_dev'].includes(new URL(databaseUrl).pathname.slice(1))
) {
  throw new Error(
    'Set PLAYWRIGHT_DATABASE_URL to a migrated disposable test database, not library or library_dev.',
  )
}
const baseURL = 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev -- --port 3100',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      KYOBO_TEST_FIXTURE: '1',
      PLAYWRIGHT_TEST_SERVER: '1',
      COVER_STORAGE_PATH: '.next/e2e/covers',
      BOOK_FILE_STORAGE_PATH: '.next/e2e/books',
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
