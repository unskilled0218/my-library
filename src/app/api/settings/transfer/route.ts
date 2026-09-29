import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ActorType,
  BookFormat,
  OwnershipState,
  ReadingState,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { removeCover, saveCoverData } from '@/lib/covers'
import { db } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { upsertGenrePaths } from '@/lib/genres'
import { assertRateLimit } from '@/lib/rate-limit'
import {
  accountBackupSchema,
  type AccountImportLibrary,
  type ImportBook,
} from '@/lib/transfer-schema'

const MAX_IMPORT_BYTES = 50 * 1024 * 1024

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

export async function GET() {
  const user = await currentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const [libraries, settings, shelfTags, genres] = await Promise.all([
    db.library.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
      include: {
        books: {
          orderBy: { createdAt: 'asc' },
          include: { genres: true, locationTag: true },
        },
      },
    }),
    db.userDisplaySettings.findUnique({ where: { userId: user.id } }),
    db.locationTag.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    }),
    db.genre.findMany(),
  ])
  const genreMap = new Map(genres.map((genre) => [genre.id, genre]))
  const exportedLibraries = await Promise.all(
    libraries.map(async (library) => ({
      name: library.name,
      description: library.description,
      books: await Promise.all(
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
      ),
    })),
  )

  const backup = {
    version: 1,
    settings: settings
      ? {
          defaultView: settings.defaultView,
          showCover: settings.showCover,
          showTitle: settings.showTitle,
          showAuthors: settings.showAuthors,
          showGenre: settings.showGenre,
          showReading: settings.showReading,
          showLocation: settings.showLocation,
        }
      : undefined,
    shelfTags: shelfTags.map((tag) => tag.name),
    libraries: exportedLibraries,
  } as const
  const validated = accountBackupSchema.safeParse(backup)
  if (!validated.success)
    return Response.json(
      { error: 'The account exceeds the supported transfer limits' },
      { status: 413 },
    )
  const payload = JSON.stringify(validated.data)
  if (Buffer.byteLength(payload) > MAX_IMPORT_BYTES)
    return Response.json(
      { error: 'The account backup exceeds the 50 MB transfer limit' },
      { status: 413 },
    )
  return new Response(payload, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="my-library-account.json"',
    },
  })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  try {
    assertRateLimit(`account-import:${user.id}`, 10, 60 * 60_000)
  } catch {
    return Response.json(
      { error: 'Too many import attempts. Try again later.' },
      { status: 429 },
    )
  }
  const contentLength = Number(request.headers.get('content-length'))
  if (contentLength && contentLength > MAX_IMPORT_BYTES + 1024 * 1024)
    return Response.json(
      { error: 'The account backup exceeds the 50 MB transfer limit' },
      { status: 413 },
    )
  const form = await request.formData()
  const file = form.get('file')
  if (
    !(file instanceof File) ||
    file.size > MAX_IMPORT_BYTES ||
    (!file.type.includes('json') && !file.name.endsWith('.json'))
  )
    return Response.json(
      { error: 'Select a valid account JSON backup under 50 MB' },
      { status: 400 },
    )

  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return Response.json(
      { error: 'The account backup could not be parsed' },
      { status: 400 },
    )
  }
  const result = accountBackupSchema.safeParse(raw)
  if (!result.success)
    return Response.json(
      {
        error: 'The file does not match account backup version 1',
        issues: result.error.issues.slice(0, 10),
      },
      { status: 400 },
    )
  const bookCount = result.data.libraries.reduce(
    (total, library) => total + library.books.length,
    0,
  )
  if (form.get('apply') !== 'true')
    return Response.json({
      valid: true,
      libraries: result.data.libraries.length,
      books: bookCount,
      duplicates: 0,
      willCreate: bookCount,
    })

  const writtenCovers: string[] = []
  try {
    const prepared: {
      library: AccountImportLibrary
      books: {
        book: ImportBook
        cover: {
          key: string
          mime: string
          width: number
          height: number
        } | null
      }[]
    }[] = []
    for (const library of result.data.libraries) {
      const books = []
      for (const book of library.books) {
        const cover = book.cover
          ? await saveCoverData(Buffer.from(book.cover.base64, 'base64'))
          : null
        if (cover) writtenCovers.push(cover.key)
        books.push({ book, cover })
      }
      prepared.push({ library, books })
    }
    const locationNames = new Set([
      ...result.data.shelfTags,
      ...prepared.flatMap(({ books }) =>
        books.flatMap(({ book }) => (book.location ? [book.location] : [])),
      ),
    ])

    await db.$transaction(
      async (tx) => {
        if (result.data.settings)
          await tx.userDisplaySettings.upsert({
            where: { userId: user.id },
            update: result.data.settings,
            create: { userId: user.id, ...result.data.settings },
          })
        const locationIds = new Map<string, string>()
        for (const name of locationNames) {
          const location = await tx.locationTag.upsert({
            where: { userId_name: { userId: user.id, name } },
            update: {},
            create: { userId: user.id, name },
          })
          locationIds.set(name, location.id)
        }
        for (const { library, books } of prepared) {
          const createdLibrary = await tx.library.create({
            data: {
              ownerId: user.id,
              name: library.name,
              description: library.description,
            },
          })
          for (const { book, cover } of books) {
            const genreIds = await upsertGenrePaths(tx, book.genrePaths)
            await tx.book.create({
              data: {
                libraryId: createdLibrary.id,
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
                locationTagId: book.location
                  ? locationIds.get(book.location)
                  : undefined,
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
              action: 'ACCOUNT_LIBRARY_IMPORTED',
              targetType: 'Library',
              targetId: createdLibrary.id,
              libraryId: createdLibrary.id,
              summary: { count: books.length },
            },
          })
        }
      },
      { timeout: 60_000 },
    )
  } catch (error) {
    await Promise.all(writtenCovers.map(removeCover))
    throw error
  }
  revalidatePath('/settings')
  revalidatePath('/libraries', 'layout')
  return Response.json({
    imported: bookCount,
    skipped: 0,
    libraries: result.data.libraries.length,
  })
}
