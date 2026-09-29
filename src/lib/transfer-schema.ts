import { z } from 'zod'
import { kyoboBookUrlSchema, kyoboGenreUrlSchema } from '@/lib/validation'

const genrePathSchema = z
  .array(
    z.object({ name: z.string().min(1).max(100), url: kyoboGenreUrlSchema }),
  )
  .min(1)
  .max(12)

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
  cover: z
    .object({
      mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      base64: z.string().max(7_000_000),
    })
    .nullable()
    .optional(),
})

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
])

export const accountBackupSchema = z
  .object({
    version: z.literal(1),
    settings: settingsSchema.optional(),
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
  })
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
  })

export type ImportBook = z.infer<typeof bookSchema>
export type AccountImportLibrary = z.infer<
  typeof accountBackupSchema
>['libraries'][number]
