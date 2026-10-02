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
import { setLanguageCookie } from '@/lib/i18n/cookie'
import {
  accountBackupSchema,
  type AccountImportLibrary,
  type ImportFolder,
  type ImportBook,
  type Version3ImportBook,
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

function orderFolders(folders: ImportFolder[]) {
  const ordered: ImportFolder[] = []
  const remaining = new Map(folders.map((folder) => [folder.key, folder]))
  while (remaining.size) {
    let added = 0
    for (const [key, folder] of remaining)
      if (!folder.parentKey || !remaining.has(folder.parentKey)) {
        ordered.push(folder)
        remaining.delete(key)
        added += 1
      }
    if (!added) throw new Error('Folder cycle detected')
  }
  return ordered
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
        folders: { orderBy: { createdAt: 'asc' } },
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
    libraries.map(async (library) => {
      const bookKeys = new Map(
        library.books.map((book, index) => [book.id, `book-${index + 1}`]),
      )
      const folderKeys = new Map(
        library.folders.map((folder, index) => [
          folder.id,
          `folder-${index + 1}`,
        ]),
      )
      return {
        name: library.name,
        description: library.description,
        books: await Promise.all(
          library.books.map(async (book) => ({
            key: bookKeys.get(book.id)!,
            folderKey: book.folderId
              ? (folderKeys.get(book.folderId) ?? null)
              : null,
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
        folders: await Promise.all(
          library.folders.map(async (folder) => ({
            key: folderKeys.get(folder.id)!,
            title: folder.title,
            parentKey: folder.parentId
              ? (folderKeys.get(folder.parentId) ?? null)
              : null,
            coverBookKey: folder.coverBookId
              ? (bookKeys.get(folder.coverBookId) ?? null)
              : null,
            customCover: folder.customCoverKey
              ? {
                  mime: folder.customCoverMime,
                  base64: (
                    await readFile(
                      path.join(
                        getEnv().COVER_STORAGE_PATH,
                        folder.customCoverKey,
                      ),
                    )
                  ).toString('base64'),
                }
              : null,
          })),
        ),
      }
    }),
  )

  const backup = {
    version: 3,
    settings: settings
      ? {
          defaultView: settings.defaultView,
          language: settings.language,
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
    return Response.json({ error: 'account-transfer-limit' }, { status: 413 })
  const payload = JSON.stringify(validated.data)
  if (Buffer.byteLength(payload) > MAX_IMPORT_BYTES)
    return Response.json({ error: 'account-size-limit' }, { status: 413 })
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
    return Response.json({ error: 'import-rate-limited' }, { status: 429 })
  }
  const contentLength = Number(request.headers.get('content-length'))
  if (contentLength && contentLength > MAX_IMPORT_BYTES + 1024 * 1024)
    return Response.json({ error: 'account-size-limit' }, { status: 413 })
  const form = await request.formData()
  const file = form.get('file')
  if (
    !(file instanceof File) ||
    file.size > MAX_IMPORT_BYTES ||
    (!file.type.includes('json') && !file.name.endsWith('.json'))
  )
    return Response.json({ error: 'invalid-account-file' }, { status: 400 })

  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return Response.json({ error: 'account-parse-failed' }, { status: 400 })
  }
  const result = accountBackupSchema.safeParse(raw)
  if (!result.success)
    return Response.json(
      {
        error: 'invalid-account-backup-version',
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
        book: ImportBook | Version3ImportBook
        cover: {
          key: string
          mime: string
          width: number
          height: number
        } | null
      }[]
      folders: {
        folder: ImportFolder
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
      const folders = []
      for (const folder of orderFolders(
        'folders' in library ? library.folders : [],
      )) {
        const cover = folder.customCover
          ? await saveCoverData(
              Buffer.from(folder.customCover.base64, 'base64'),
            )
          : null
        if (cover) writtenCovers.push(cover.key)
        folders.push({ folder, cover })
      }
      prepared.push({ library, books, folders })
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
        for (const { library, books, folders } of prepared) {
          const createdLibrary = await tx.library.create({
            data: {
              ownerId: user.id,
              name: library.name,
              description: library.description,
            },
          })
          const folderIds = new Map<string, string>()
          for (const { folder, cover } of folders) {
            const created = await tx.libraryFolder.create({
              data: {
                libraryId: createdLibrary.id,
                title: folder.title,
                parentId: folder.parentKey
                  ? folderIds.get(folder.parentKey)
                  : undefined,
                customCoverKey: cover?.key,
                customCoverMime: cover?.mime,
                customCoverWidth: cover?.width,
                customCoverHeight: cover?.height,
              },
            })
            folderIds.set(folder.key, created.id)
          }
          const bookIds = new Map<string, string>()
          for (const { book, cover } of books) {
            const genreIds = await upsertGenrePaths(tx, book.genrePaths)
            const created = await tx.book.create({
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
                folderId:
                  'folderKey' in book && book.folderKey
                    ? folderIds.get(book.folderKey)
                    : undefined,
                coverKey: cover?.key,
                coverMime: cover?.mime,
                coverWidth: cover?.width,
                coverHeight: cover?.height,
                genres: { create: genreIds.map((genreId) => ({ genreId })) },
              },
            })
            if ('key' in book) bookIds.set(book.key, created.id)
          }
          for (const { folder } of folders)
            if (folder.coverBookKey)
              await tx.libraryFolder.update({
                where: { id: folderIds.get(folder.key)! },
                data: { coverBookId: bookIds.get(folder.coverBookKey)! },
              })
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
  if (result.data.version !== 1 && result.data.settings?.language)
    await setLanguageCookie(result.data.settings.language)
  return Response.json({
    imported: bookCount,
    skipped: 0,
    libraries: result.data.libraries.length,
  })
}
