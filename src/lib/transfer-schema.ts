import { z } from 'zod'
import { kyoboBookUrlSchema, kyoboGenreUrlSchema } from '@/lib/validation'

const genrePathSchema = z
  .array(
    z.object({ name: z.string().min(1).max(100), url: kyoboGenreUrlSchema }),
  )
  .min(1)
  .max(12)

const MAX_FOLDERS = 5_000
const backupKeySchema = z.string().min(1).max(100)
const coverSchema = z
  .object({
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    base64: z
      .string()
      .min(1)
      .max(7_000_000)
      .refine(
        (value) =>
          value.length % 4 === 0 &&
          /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            value,
          ) &&
          Buffer.byteLength(value, 'base64') <= 5 * 1024 * 1024,
        'Cover payload is invalid or too large',
      ),
  })
  .nullable()
  .optional()

const bookSchema = z.object({
  title: z.string().min(1).max(300),
  authors: z.array(z.string().min(1).max(120)).min(1),
  description: z.string().max(5_000).default(''),
  isbn10: z.string().nullable().optional(),
  isbn13: z.string().nullable().optional(),
  sourceUrl: kyoboBookUrlSchema,
  format: z.enum(['PHYSICAL', 'EBOOK']).default('PHYSICAL'),
  ownershipState: z.enum(['HAVE', 'DONT_HAVE']).default('HAVE'),
  readingState: z
    .enum(['NOT_STARTED', 'READING', 'DONE'])
    .default('NOT_STARTED'),
  readingStartedAt: z.string().datetime().nullable().optional(),
  readingFinishedAt: z.string().datetime().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().max(10_000).default(''),
  location: z.string().max(80).nullable().optional(),
  genrePaths: z.array(genrePathSchema).min(1),
  cover: coverSchema,
})

const version3BookSchema = bookSchema.extend({
  key: backupKeySchema,
  folderKey: backupKeySchema.nullable().default(null),
})

const folderSchema = z.object({
  key: backupKeySchema,
  title: z.string().trim().min(1).max(100),
  parentKey: backupKeySchema.nullable().default(null),
  coverBookKey: backupKeySchema.nullable().default(null),
  customCover: coverSchema,
})

function validateVersion3Library(
  library: {
    books: z.infer<typeof version3BookSchema>[]
    folders: z.infer<typeof folderSchema>[]
  },
  context: z.RefinementCtx,
) {
  const bookKeys = new Set<string>()
  for (const [index, book] of library.books.entries()) {
    if (bookKeys.has(book.key))
      context.addIssue({
        code: 'custom',
        path: ['books', index, 'key'],
        message: 'Book keys must be unique',
      })
    bookKeys.add(book.key)
  }

  const folderKeys = new Set<string>()
  for (const [index, folder] of library.folders.entries()) {
    if (folderKeys.has(folder.key))
      context.addIssue({
        code: 'custom',
        path: ['folders', index, 'key'],
        message: 'Folder keys must be unique',
      })
    folderKeys.add(folder.key)
  }

  const siblingNames = new Set<string>()
  for (const [index, folder] of library.folders.entries()) {
    if (folder.parentKey && !folderKeys.has(folder.parentKey))
      context.addIssue({
        code: 'custom',
        path: ['folders', index, 'parentKey'],
        message: 'Folder parent does not exist',
      })
    if (folder.coverBookKey && !bookKeys.has(folder.coverBookKey))
      context.addIssue({
        code: 'custom',
        path: ['folders', index, 'coverBookKey'],
        message: 'Folder cover book does not exist',
      })
    if (folder.coverBookKey && folder.customCover)
      context.addIssue({
        code: 'custom',
        path: ['folders', index],
        message: 'Folder may have only one cover source',
      })
    const siblingKey = `${folder.parentKey ?? ''}\0${folder.title}`
    if (siblingNames.has(siblingKey))
      context.addIssue({
        code: 'custom',
        path: ['folders', index, 'title'],
        message: 'Sibling folder titles must be unique',
      })
    siblingNames.add(siblingKey)
  }

  for (const [index, book] of library.books.entries())
    if (book.folderKey && !folderKeys.has(book.folderKey))
      context.addIssue({
        code: 'custom',
        path: ['books', index, 'folderKey'],
        message: 'Book folder does not exist',
      })

  const foldersByKey = new Map(
    library.folders.map((folder) => [folder.key, folder]),
  )
  for (const [index, folder] of library.folders.entries()) {
    const seen = new Set<string>()
    let current: typeof folder | undefined = folder
    for (
      let depth = 0;
      current && depth <= library.folders.length;
      depth += 1
    ) {
      if (seen.has(current.key)) {
        context.addIssue({
          code: 'custom',
          path: ['folders', index, 'parentKey'],
          message: 'Folder hierarchy contains a cycle',
        })
        break
      }
      seen.add(current.key)
      current = current.parentKey
        ? foldersByKey.get(current.parentKey)
        : undefined
    }
  }
}

const version3LibrarySchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    books: z.array(version3BookSchema).max(5_000),
    folders: z.array(folderSchema).max(MAX_FOLDERS),
  })
  .superRefine(validateVersion3Library)

export const settingsSchema = z.object({
  defaultView: z.enum(['LIST', 'GRID']),
  showCover: z.boolean(),
  showTitle: z.boolean(),
  showAuthors: z.boolean(),
  showGenre: z.boolean(),
  showReading: z.boolean(),
  showLocation: z.boolean(),
})

const legacyBackupSchema = z.object({
  version: z.literal(1),
  library: z.object({
    name: z.string(),
    description: z.string(),
    locationTags: z.array(z.string().max(80)).max(1_000).default([]),
    settings: settingsSchema.optional(),
  }),
  books: z.array(bookSchema).max(5_000),
})

export const backupSchema = z.discriminatedUnion('version', [
  legacyBackupSchema,
  z.object({
    version: z.literal(2),
    library: z.object({
      name: z.string(),
      description: z.string(),
    }),
    books: z.array(bookSchema).max(5_000),
  }),
  z
    .object({
      version: z.literal(3),
      library: z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500),
      }),
      books: z.array(version3BookSchema).max(5_000),
      folders: z.array(folderSchema).max(MAX_FOLDERS),
    })
    .superRefine((backup, context) => validateVersion3Library(backup, context)),
])

const accountBackupBase = {
  shelfTags: z.array(z.string().max(80)).max(1_000).default([]),
  libraries: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500),
        books: z.array(bookSchema).max(5_000),
      }),
    )
    .max(100),
}

const accountSettingsSchema = settingsSchema.extend({
  language: z.enum(['KO', 'EN']),
})

export const accountBackupSchema = z
  .discriminatedUnion('version', [
    z.object({
      version: z.literal(1),
      settings: settingsSchema.optional(),
      ...accountBackupBase,
    }),
    z.object({
      version: z.literal(2),
      settings: accountSettingsSchema.optional(),
      ...accountBackupBase,
    }),
    z.object({
      version: z.literal(3),
      settings: accountSettingsSchema.optional(),
      shelfTags: z.array(z.string().max(80)).max(1_000).default([]),
      libraries: z.array(version3LibrarySchema).max(100),
    }),
  ])
  .superRefine((backup, context) => {
    const books = backup.libraries.reduce(
      (total, library) => total + library.books.length,
      0,
    )
    if (books > 5_000)
      context.addIssue({
        code: 'custom',
        path: ['libraries'],
        message: 'Account backups may contain at most 5,000 books',
      })
    if (
      backup.version === 3 &&
      backup.libraries.reduce(
        (total, library) => total + library.folders.length,
        0,
      ) > MAX_FOLDERS
    )
      context.addIssue({
        code: 'custom',
        path: ['libraries'],
        message: 'Account backups may contain at most 5,000 folders',
      })
  })

export function encodeFolderPath(segments: string[]) {
  return segments
    .map((segment) => segment.replaceAll('\\', '\\\\').replaceAll('/', '\\/'))
    .join('/')
}

export function decodeFolderPath(value: string) {
  if (!value) return []
  const segments: string[] = []
  let segment = ''
  let escaped = false
  for (const character of value) {
    if (escaped) {
      if (character !== '/' && character !== '\\')
        throw new Error('Invalid folder path escape')
      segment += character
      escaped = false
    } else if (character === '\\') escaped = true
    else if (character === '/') {
      if (!segment) throw new Error('Invalid empty folder path segment')
      segments.push(segment)
      segment = ''
    } else segment += character
  }
  if (escaped || !segment) throw new Error('Invalid folder path')
  segments.push(segment)
  return segments
}

export type ImportBook = z.infer<typeof bookSchema>
export type Version3ImportBook = z.infer<typeof version3BookSchema>
export type ImportFolder = z.infer<typeof folderSchema>
export type AccountImportLibrary = z.infer<
  typeof accountBackupSchema
>['libraries'][number]
