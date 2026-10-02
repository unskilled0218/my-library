import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  path.join(
    process.cwd(),
    'prisma/migrations/20261002120000_book_files/migration.sql',
  ),
  'utf8',
)

describe('book file migration', () => {
  it('enforces one file per type and cascades book deletion', () => {
    expect(migration).toContain(
      "CREATE TYPE \"BookFileType\" AS ENUM ('EPUB', 'PDF')",
    )
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "BookFile_bookId_type_key"',
    )
    expect(migration).toContain('ON DELETE CASCADE')
  })
})
