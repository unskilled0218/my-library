import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ActorType,
  BookFormat,
  OwnershipState,
  ReadingState,
} from '@prisma/client'
import Papa from 'papaparse'
import { requireLibraryAccess } from '@/lib/access'
import { currentUser } from '@/lib/auth'
import { getEnv } from '@/lib/env'
import { saveCoverData, removeCover } from '@/lib/covers'
import { db } from '@/lib/db'
import { upsertGenrePaths } from '@/lib/genres'
import { backupSchema, type ImportBook } from '@/lib/transfer-schema'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024

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
      version: 2,
      library: {
        name: library.name,
        description: library.description,
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
      { error: 'invalid-or-oversized-file' },
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
        version: 2,
        library: { name: 'CSV import', description: '' },
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
    return Response.json({ error: 'file-parse-failed' }, { status: 400 })
  }
  const result = backupSchema.safeParse(raw)
  if (!result.success)
    return Response.json(
      {
        error: 'invalid-backup-version',
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
    const locationNames = new Set([
      ...(result.data.version === 1 ? result.data.library.locationTags : []),
      ...prepared.flatMap(({ book }) => (book.location ? [book.location] : [])),
    ])
    await db.$transaction(
      async (tx) => {
        const locationIds = new Map<string, string>()
        for (const name of locationNames) {
          const location = await tx.locationTag.upsert({
            where: { userId_name: { userId: user.id, name } },
            update: {},
            create: { userId: user.id, name },
          })
          locationIds.set(name, location.id)
        }
        for (const { book, cover } of prepared) {
          const genreIds = await upsertGenrePaths(tx, book.genrePaths)
          const locationTagId = book.location
            ? locationIds.get(book.location)
            : undefined
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
