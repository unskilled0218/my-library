import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ActorType,
  BookFormat,
  OwnershipState,
  ReadingState,
} from '@prisma/client'
import Papa from 'papaparse'
import { z } from 'zod'
import { requireLibraryAccess } from '@/lib/access'
import { currentUser } from '@/lib/auth'
import { getEnv } from '@/lib/env'
import { saveCoverData, removeCover } from '@/lib/covers'
import { db } from '@/lib/db'
import { upsertGenrePaths } from '@/lib/genres'
import { kyoboBookUrlSchema, kyoboGenreUrlSchema } from '@/lib/validation'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const genrePathSchema = z
  .array(
    z.object({ name: z.string().min(1).max(100), url: kyoboGenreUrlSchema }),
  )
  .min(1)
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
const settingsSchema = z.object({
  defaultView: z.enum(['LIST', 'GRID']),
  showCover: z.boolean(),
  showTitle: z.boolean(),
  showAuthors: z.boolean(),
  showGenre: z.boolean(),
  showReading: z.boolean(),
  showLocation: z.boolean(),
})
const backupSchema = z.object({
  version: z.literal(1),
  library: z.object({
    name: z.string(),
    description: z.string(),
    locationTags: z.array(z.string().max(80)).default([]),
    settings: settingsSchema.optional(),
  }),
  books: z.array(bookSchema).max(5_000),
})
type ImportBook = z.infer<typeof bookSchema>

type Params = { params: Promise<{ id: string }> }

function pathsForGenre(
  genreId: string,
  genres: Map<string, { name: string; url: string; parentId: string | null }>,
) {
  const result: { name: string; url: string }[] = []
  const seen = new Set<string>()
  let id: string | null = genreId
  while (id) {
    if (seen.has(id)) throw new Error('Genre cycle detected')
    seen.add(id)
    const genre = genres.get(id)
    if (!genre) break
    result.unshift({ name: genre.name, url: genre.url })
    id = genre.parentId
  }
  return result
}

export async function GET(request: Request, { params }: Params) {
  const user = await currentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  try {
    await requireLibraryAccess(user, id, 'OWNER')
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const library = await db.library.findUniqueOrThrow({
    where: { id },
    include: {
      settings: true,
      locationTags: true,
      books: { include: { genres: true, locationTag: true } },
    },
  })
  const allGenres = await db.genre.findMany()
  const genreMap = new Map(allGenres.map((genre) => [genre.id, genre]))
  const books = await Promise.all(
    library.books.map(async (book) => ({
      title: book.title,
      authors: book.authors,
      description: book.description,
      isbn10: book.isbn10,
      isbn13: book.isbn13,
      sourceUrl: book.sourceUrl,
      format: book.format,
      ownershipState: book.ownershipState,
      readingState: book.readingState,
      readingStartedAt: book.readingStartedAt?.toISOString() ?? null,
      readingFinishedAt: book.readingFinishedAt?.toISOString() ?? null,
      rating: book.rating,
      comment: book.comment,
      location: book.locationTag?.name ?? null,
      genrePaths: book.genres.map(({ genreId }) =>
        pathsForGenre(genreId, genreMap),
      ),
      cover: book.coverKey
        ? {
            mime: book.coverMime,
            base64: (
              await readFile(
                path.join(getEnv().COVER_STORAGE_PATH, book.coverKey),
              )
            ).toString('base64'),
          }
        : null,
    })),
  )
  const format = new URL(request.url).searchParams.get('format')
  if (format === 'csv') {
    const csv = Papa.unparse(
      books.map((book) => ({
        title: book.title,
        authors: book.authors.join('; '),
        description: book.description,
        isbn10: book.isbn10,
        isbn13: book.isbn13,
        sourceUrl: book.sourceUrl,
        format: book.format,
        ownershipState: book.ownershipState,
        readingState: book.readingState,
        rating: book.rating,
        comment: book.comment,
        location: book.location,
        genrePaths: JSON.stringify(book.genrePaths),
      })),
    )
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="library-${id}.csv"`,
      },
    })
  }
  return Response.json(
    {
      version: 1,
      library: {
        name: library.name,
        description: library.description,
        locationTags: library.locationTags.map((tag) => tag.name),
        settings: library.settings,
      },
      books,
    },
    {
      headers: {
        'Content-Disposition': `attachment; filename="library-${id}.json"`,
      },
    },
  )
}

export async function POST(request: Request, { params }: Params) {
  const user = await currentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  try {
    await requireLibraryAccess(user, id, 'OWNER')
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size > MAX_IMPORT_BYTES)
    return Response.json(
      { error: 'Invalid or oversized file' },
      { status: 400 },
    )
  const text = await file.text()
  let raw: unknown
  try {
    if (file.type.includes('csv') || file.name.endsWith('.csv')) {
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      })
      raw = {
        version: 1,
        library: { name: 'CSV import', description: '', locationTags: [] },
        books: parsed.data.map((row) => ({
          ...row,
          authors: row.authors?.split(';').map((item) => item.trim()),
          rating: row.rating ? Number(row.rating) : null,
          genrePaths: JSON.parse(row.genrePaths || '[]'),
          cover: null,
        })),
      }
    } else raw = JSON.parse(text)
  } catch {
    return Response.json(
      { error: 'The file could not be parsed' },
      { status: 400 },
    )
  }
  const result = backupSchema.safeParse(raw)
  if (!result.success)
    return Response.json(
      {
        error: 'The file does not match backup version 1',
        issues: result.error.issues.slice(0, 10),
      },
      { status: 400 },
    )
  const duplicateClauses = result.data.books.flatMap((book) => [
    ...(book.isbn13 ? [{ isbn13: book.isbn13 }] : []),
    { sourceUrl: book.sourceUrl },
  ])
  const existing = await db.book.findMany({
    where: { libraryId: id, OR: duplicateClauses },
    select: { isbn13: true, sourceUrl: true },
  })
  const duplicateKeys = new Set(
    existing.flatMap((book) => [book.isbn13, book.sourceUrl].filter(Boolean)),
  )
  const duplicates = result.data.books.filter(
    (book) =>
      duplicateKeys.has(book.isbn13 ?? '') || duplicateKeys.has(book.sourceUrl),
  ).length
  if (form.get('apply') !== 'true')
    return Response.json({
      valid: true,
      books: result.data.books.length,
      duplicates,
      willCreate: result.data.books.length - duplicates,
    })
  const writtenCovers: string[] = []
  try {
    const pending = result.data.books.filter(
      (book) =>
        !duplicateKeys.has(book.isbn13 ?? '') &&
        !duplicateKeys.has(book.sourceUrl),
    )
    const prepared: {
      book: ImportBook
      cover: { key: string; mime: string; width: number; height: number } | null
    }[] = []
    for (const book of pending) {
      const cover = book.cover
        ? await saveCoverData(Buffer.from(book.cover.base64, 'base64'))
        : null
      if (cover) writtenCovers.push(cover.key)
      prepared.push({ book, cover })
    }
    await db.$transaction(
      async (tx) => {
        for (const name of result.data.library.locationTags)
          await tx.locationTag.upsert({
            where: { libraryId_name: { libraryId: id, name } },
            update: {},
            create: { libraryId: id, name },
          })
        if (result.data.library.settings)
          await tx.libraryDisplaySettings.upsert({
            where: { libraryId: id },
            update: result.data.library.settings,
            create: { libraryId: id, ...result.data.library.settings },
          })
        for (const { book, cover } of prepared) {
          const genreIds = await upsertGenrePaths(tx, book.genrePaths)
          let locationTagId: string | undefined
          if (book.location)
            locationTagId = (
              await tx.locationTag.upsert({
                where: {
                  libraryId_name: { libraryId: id, name: book.location },
                },
                update: {},
                create: { libraryId: id, name: book.location },
              })
            ).id
          await tx.book.create({
            data: {
              libraryId: id,
              title: book.title,
              authors: book.authors,
              description: book.description,
              isbn10: book.isbn10,
              isbn13: book.isbn13,
              sourceUrl: book.sourceUrl,
              format: book.format as BookFormat,
              ownershipState: book.ownershipState as OwnershipState,
              readingState: book.readingState as ReadingState,
              readingStartedAt: book.readingStartedAt
                ? new Date(book.readingStartedAt)
                : null,
              readingFinishedAt: book.readingFinishedAt
                ? new Date(book.readingFinishedAt)
                : null,
              rating: book.rating,
              comment: book.comment,
              locationTagId,
              coverKey: cover?.key,
              coverMime: cover?.mime,
              coverWidth: cover?.width,
              coverHeight: cover?.height,
              genres: { create: genreIds.map((genreId) => ({ genreId })) },
            },
          })
        }
        await tx.auditLog.create({
          data: {
            actorType: ActorType.USER,
            actorId: user.id,
            action: 'LIBRARY_IMPORTED',
            targetType: 'Library',
            targetId: id,
            libraryId: id,
            summary: { count: prepared.length, skippedDuplicates: duplicates },
          },
        })
      },
      { timeout: 30_000 },
    )
  } catch (error) {
    await Promise.all(writtenCovers.map(removeCover))
    throw error
  }
  return Response.json({
    imported: result.data.books.length - duplicates,
    skipped: duplicates,
  })
}
