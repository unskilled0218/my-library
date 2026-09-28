import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20260928210000_global_settings/migration.sql',
  ),
  'utf8',
)

describe('global settings migration', () => {
  it('creates one display preference for every existing user', () => {
    expect(migration).toContain('FROM "User" u')
    expect(migration).toContain('ORDER BY library."createdAt" ASC')
    expect(migration).toContain('COALESCE(canonical."defaultView"')
  })

  it('repoints books before duplicate shelf tags are deleted', () => {
    const repoint = migration.indexOf('UPDATE "Book" book')
    const removeDuplicates = migration.indexOf('DELETE FROM "LocationTag" tag')

    expect(repoint).toBeGreaterThan(-1)
    expect(removeDuplicates).toBeGreaterThan(repoint)
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "LocationTag_userId_name_key"',
    )
  })
})
