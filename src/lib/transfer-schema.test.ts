import { describe, expect, it } from 'vitest'
import {
  accountBackupSchema,
  backupSchema,
  decodeFolderPath,
  encodeFolderPath,
} from '@/lib/transfer-schema'

const settings = {
  defaultView: 'LIST',
  showCover: true,
  showTitle: true,
  showAuthors: true,
  showGenre: true,
  showReading: true,
  showLocation: false,
}

const book = {
  title: 'Book',
  authors: ['Author'],
  sourceUrl: 'https://product.kyobobook.co.kr/detail/S000000000001',
  genrePaths: [
    [
      {
        name: 'Genre',
        url: 'https://store.kyobobook.co.kr/category/KOR/01',
      },
    ],
  ],
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

  it('accepts version 3 folders and stable references', () => {
    const result = backupSchema.safeParse({
      version: 3,
      library: { name: 'Nested', description: '' },
      folders: [
        { key: 'f1', title: 'Parent' },
        { key: 'f2', title: 'Child', parentKey: 'f1', coverBookKey: 'b1' },
      ],
      books: [
        {
          ...book,
          key: 'b1',
          folderKey: 'f2',
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it.each([
    {
      folders: [],
      books: [
        { ...book, key: 'same' },
        {
          ...book,
          key: 'same',
          sourceUrl: 'https://product.kyobobook.co.kr/detail/S000000000002',
        },
      ],
    },
    {
      folders: [],
      books: [{ ...book, key: 'book', folderKey: 'missing' }],
    },
    {
      folders: [{ key: 'folder', title: 'Folder', coverBookKey: 'missing' }],
      books: [],
    },
  ])('rejects invalid version 3 book references', ({ folders, books }) => {
    expect(
      backupSchema.safeParse({
        version: 3,
        library: { name: 'Invalid', description: '' },
        folders,
        books,
      }).success,
    ).toBe(false)
  })

  it('limits folder count', () => {
    expect(
      backupSchema.safeParse({
        version: 3,
        library: { name: 'Too many', description: '' },
        folders: Array.from({ length: 5_001 }, (_, index) => ({
          key: `folder-${index}`,
          title: `Folder ${index}`,
        })),
        books: [],
      }).success,
    ).toBe(false)
  })

  it.each([
    {
      folders: [
        { key: 'same', title: 'One' },
        { key: 'same', title: 'Two' },
      ],
      books: [],
    },
    {
      folders: [{ key: 'child', title: 'Child', parentKey: 'missing' }],
      books: [],
    },
    {
      folders: [
        { key: 'one', title: 'One', parentKey: 'two' },
        { key: 'two', title: 'Two', parentKey: 'one' },
      ],
      books: [],
    },
    {
      folders: [
        { key: 'one', title: 'Same' },
        { key: 'two', title: 'Same' },
      ],
      books: [],
    },
  ])('rejects invalid version 3 folder graphs', ({ folders, books }) => {
    expect(
      backupSchema.safeParse({
        version: 3,
        library: { name: 'Invalid', description: '' },
        folders,
        books,
      }).success,
    ).toBe(false)
  })

  it('rejects unknown backup versions', () => {
    expect(
      backupSchema.safeParse({
        version: 4,
        library: { name: 'Unknown', description: '' },
        books: [],
      }).success,
    ).toBe(false)
  })
})

describe('account backup schema', () => {
  it('accepts legacy version 1 account backups', () => {
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

  it('round trips language in version 2 account backups', () => {
    const result = accountBackupSchema.safeParse({
      version: 2,
      settings: { ...settings, language: 'EN' },
      shelfTags: [],
      libraries: [],
    })

    expect(result.success).toBe(true)
    if (result.success && result.data.version === 2)
      expect(result.data.settings?.language).toBe('EN')
  })

  it('accepts version 3 account backups with folders', () => {
    expect(
      accountBackupSchema.safeParse({
        version: 3,
        shelfTags: [],
        libraries: [
          { name: 'Nested', description: '', books: [], folders: [] },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects invalid language and unknown account backup versions', () => {
    expect(
      accountBackupSchema.safeParse({
        version: 2,
        settings: { ...settings, language: 'FR' },
        shelfTags: [],
        libraries: [],
      }).success,
    ).toBe(false)
    expect(
      accountBackupSchema.safeParse({
        version: 4,
        shelfTags: [],
        libraries: [],
      }).success,
    ).toBe(false)
  })
})

describe('CSV folder paths', () => {
  it('round trips separators and escape characters', () => {
    const segments = ['One/Two', String.raw`Three\Four`, 'Five']
    expect(decodeFolderPath(encodeFolderPath(segments))).toEqual(segments)
    expect(decodeFolderPath('')).toEqual([])
  })

  it.each(['one//two', 'one/', String.raw`one\q`])(
    'rejects ambiguous path %s',
    (value) => expect(() => decodeFolderPath(value)).toThrow(),
  )
})
