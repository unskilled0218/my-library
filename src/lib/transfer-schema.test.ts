import { describe, expect, it } from 'vitest'
import { accountBackupSchema, backupSchema } from '@/lib/transfer-schema'

const settings = {
  defaultView: 'LIST',
  showCover: true,
  showTitle: true,
  showAuthors: true,
  showGenre: true,
  showReading: true,
  showLocation: false,
}

describe('library backup schema', () => {
  it('accepts legacy version 1 backups with per-library settings', () => {
    const result = backupSchema.safeParse({
      version: 1,
      library: {
        name: 'Legacy library',
        description: '',
        locationTags: ['Study'],
        settings,
      },
      books: [],
    })

    expect(result.success).toBe(true)
    if (result.success && result.data.version === 1)
      expect(result.data.library.locationTags).toEqual(['Study'])
  })

  it('accepts version 2 without account-wide preferences', () => {
    const result = backupSchema.safeParse({
      version: 2,
      library: { name: 'Current library', description: '' },
      books: [],
    })

    expect(result.success).toBe(true)
    if (result.success)
      expect(result.data.library).not.toHaveProperty('settings')
  })

  it('rejects unknown backup versions', () => {
    expect(
      backupSchema.safeParse({
        version: 3,
        library: { name: 'Unknown', description: '' },
        books: [],
      }).success,
    ).toBe(false)
  })
})

describe('account backup schema', () => {
  it('accepts settings, shelf tags, and multiple complete libraries', () => {
    const result = accountBackupSchema.safeParse({
      version: 1,
      settings,
      shelfTags: ['Study'],
      libraries: [
        { name: 'First', description: '', books: [] },
        { name: 'Second', description: 'Another library', books: [] },
      ],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.libraries).toHaveLength(2)
      expect(result.data.shelfTags).toEqual(['Study'])
    }
  })

  it('rejects unknown account backup versions', () => {
    expect(
      accountBackupSchema.safeParse({
        version: 2,
        shelfTags: [],
        libraries: [],
      }).success,
    ).toBe(false)
  })
})
