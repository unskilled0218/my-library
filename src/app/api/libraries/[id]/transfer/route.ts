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
import {
  backupSchema,
  decodeFolderPath,
  encodeFolderPath,
  type ImportBook,
  type ImportFolder,
  type Version3ImportBook,
} from '@/lib/transfer-schema'

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

function folderPaths(
  folders: { id: string; title: string; parentId: string | null }[],
) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const result = new Map<string, string>()
  for (const folder of folders) {
    const segments: string[] = []
    const seen = new Set<string>()
    let current: typeof folder | undefined = folder
    while (current) {
      if (seen.has(current.id) || seen.size > folders.length)
        throw new Error('Folder cycle detected')
      seen.add(current.id)
      segments.unshift(current.title)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    result.set(folder.id, encodeFolderPath(segments))
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
      books: {
        orderBy: { createdAt: 'asc' },
        include: { genres: true, locationTag: true },
      },
      folders: { orderBy: { createdAt: 'asc' } },
    },
  })
  const allGenres = await db.genre.findMany()
  const genreMap = new Map(allGenres.map((genre) => [genre.id, genre]))
  const bookKeys = new Map(
    library.books.map((book, index) => [book.id, `book-${index + 1}`]),
  )
  const folderKeys = new Map(
    library.folders.map((folder, index) => [folder.id, `folder-${index + 1}`]),
  )
  const books = await Promise.all(
    library.books.map(async (book) => ({
      key: bookKeys.get(book.id)!,
      folderKey: book.folderId ? (folderKeys.get(book.folderId) ?? null) : null,
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
  const folders = await Promise.all(
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
                path.join(getEnv().COVER_STORAGE_PATH, folder.customCoverKey),
              )
            ).toString('base64'),
          }
        : null,
    })),
  )
  const format = new URL(request.url).searchParams.get('format')
  if (format === 'csv') {
    const paths = folderPaths(library.folders)
    const pathsByKey = new Map(
      library.folders.map((folder) => [
        folderKeys.get(folder.id)!,
        paths.get(folder.id)!,
      ]),
    )
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
        folderPath: book.folderKey ? pathsByKey.get(book.folderKey) : '',
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
      version: 3,
      library: {
        name: library.name,
        description: library.description,
      },
      books,
      folders,
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
      if (parsed.errors.length) throw new Error('CSV parse failed')
      const folders: ImportFolder[] = []
      const folderKeys = new Map<string, string>()
      const books = parsed.data.map((row, bookIndex) => {
        const segments = decodeFolderPath(row.folderPath ?? '')
        let parentKey: string | null = null
        const path: string[] = []
        for (const title of segments) {
          path.push(title)
          const encoded = encodeFolderPath(path)
          let key = folderKeys.get(encoded)
          if (!key) {
            key = `csv-folder-${folders.length + 1}`
            folderKeys.set(encoded, key)
            folders.push({
              key,
              title,
              parentKey,
              coverBookKey: null,
              customCover: null,
            })
          }
          parentKey = key
        }
        return {
          ...row,
          key: `csv-book-${bookIndex + 1}`,
          folderKey: parentKey,
          authors: row.authors?.split(';').map((item) => item.trim()),
          rating: row.rating ? Number(row.rating) : null,
          genrePaths: JSON.parse(row.genrePaths || '[]'),
          cover: null,
        }
      })
      raw = {
        version: 3,
        library: { name: 'CSV import', description: '' },
        books,
        folders,
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
    select: { id: true, isbn13: true, sourceUrl: true },
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
      folders: result.data.version === 3 ? result.data.folders.length : 0,
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
      book: ImportBook | Version3ImportBook
      cover: { key: string; mime: string; width: number; height: number } | null
    }[] = []
    for (const book of pending) {
      const cover = book.cover
        ? await saveCoverData(Buffer.from(book.cover.base64, 'base64'))
        : null
      if (cover) writtenCovers.push(cover.key)
      prepared.push({ book, cover })
    }
    const importedFolders =
      result.data.version === 3 ? orderFolders(result.data.folders) : []
    const preparedFolderCovers = new Map<
      string,
      { key: string; mime: string; width: number; height: number }
    >()
    for (const folder of importedFolders) {
      if (!folder.customCover) continue
      const cover = await saveCoverData(
        Buffer.from(folder.customCover.base64, 'base64'),
      )
      writtenCovers.push(cover.key)
      preparedFolderCovers.set(folder.key, cover)
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
        const folderIds = new Map<string, string>()
        for (const folder of importedFolders) {
          const cover = preparedFolderCovers.get(folder.key)
          const created = await tx.libraryFolder.create({
            data: {
              libraryId: id,
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
        if (result.data.version === 3)
          for (const book of result.data.books) {
            const match = existing.find(
              (existingBook) =>
                existingBook.sourceUrl === book.sourceUrl ||
                Boolean(book.isbn13 && existingBook.isbn13 === book.isbn13),
            )
            if (match) bookIds.set(book.key, match.id)
          }
        for (const { book, cover } of prepared) {
          const genreIds = await upsertGenrePaths(tx, book.genrePaths)
          const locationTagId = book.location
            ? locationIds.get(book.location)
            : undefined
          const created = await tx.book.create({
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
        for (const folder of importedFolders)
          if (folder.coverBookKey)
            await tx.libraryFolder.update({
              where: { id: folderIds.get(folder.key)! },
              data: { coverBookId: bookIds.get(folder.coverBookKey)! },
            })
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
