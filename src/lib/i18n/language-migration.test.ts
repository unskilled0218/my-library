import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260929120000_korean_locale/migration.sql',
  ),
  'utf8',
)

describe('language migration', () => {
  it('adds a required Korean-default language to existing settings', () => {
    expect(migration).toContain(`CREATE TYPE "Language" AS ENUM ('KO', 'EN')`)
    expect(migration).toContain(`"language" "Language" NOT NULL DEFAULT 'KO'`)
    expect(migration).toContain(
      `UPDATE "UserDisplaySettings" SET "language" = 'KO'`,
    )
  })
})
