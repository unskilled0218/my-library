import { describe, expect, it } from 'vitest'
import { backupSchema } from '@/lib/transfer-schema'

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
