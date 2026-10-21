import 'server-only'
import { ActorType, BookFormat, type User } from '@prisma/client'
import { requireLibraryAccess } from '@/lib/access'
import { parseBookOptions, type KyoboImportResult } from '@/lib/book-options'
import { downloadCover, removeCover } from '@/lib/covers'
import { db } from '@/lib/db'
import { upsertGenrePaths } from '@/lib/genres'
import { getKyoboBook } from '@/lib/kyobo'
import { isKyoboSaleId } from '@/lib/kyobo-preview'
import { kyoboBookUrlSchema } from '@/lib/validation'

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? '').trim()

export async function importKyoboBook(
  user: Pick<User, 'id'>,
  form: FormData,
): Promise<KyoboImportResult> {
  const libraryId = value(form, 'libraryId')
  const saleId = value(form, 'saleId')
  if (!isKyoboSaleId(saleId))
    return { status: 'error', error: 'invalidProduct' }
  const parsed = parseBookOptions(form)
  if ('error' in parsed) return { status: 'error', ...parsed }
  const { options } = parsed
  try {
    await requireLibraryAccess(user, libraryId, 'WRITE')
  } catch {
    return { status: 'error', error: 'accessDenied' }
  }
  try {
    const library = await db.library.findUniqueOrThrow({
      where: { id: libraryId },
      select: { ownerId: true },
    })
    if (
      options.locationTagId &&
      !(await db.locationTag.findFirst({
        where: { id: options.locationTagId, userId: library.ownerId },
        select: { id: true },
      }))
    )
      return { status: 'error', error: 'invalidLocation' }
    if (
      options.folderId &&
      !(await db.libraryFolder.findFirst({
        where: { id: options.folderId, libraryId },
        select: { id: true },
      }))
    )
      return { status: 'error', error: 'invalidFolder' }
  } catch {
    return { status: 'error', error: 'saveFailed' }
  }
  let book: Awaited<ReturnType<typeof getKyoboBook>>
  try {
    book = await getKyoboBook(saleId)
    kyoboBookUrlSchema.parse(book.sourceUrl)
  } catch {
    return { status: 'error', error: 'detailsUnavailable' }
  }
  let cover: Awaited<ReturnType<typeof downloadCover>> | null = null
  try {
    const duplicate = await db.book.findFirst({
      where: {
        libraryId,
        OR: [
          book.isbn.length === 10
            ? { isbn10: book.isbn }
            : { isbn13: book.isbn },
          { sourceUrl: book.sourceUrl },
        ],
      },
      select: { id: true },
    })
    if (duplicate)
      return { status: 'existing', bookId: duplicate.id, libraryId }
    cover = book.coverUrl
      ? await downloadCover(book.coverUrl).catch(() => null)
      : null
    const bookId = await db.$transaction(async (tx) => {
      const genreIds = await upsertGenrePaths(tx, book.genrePaths)
      const created = await tx.book.create({
        data: {
          libraryId,
          ...options,
          locationTagId: book.format === 'EBOOK' ? null : options.locationTagId,
          title: book.title,
          authors: book.authors,
          description: book.description,
          isbn10: book.isbn.length === 10 ? book.isbn : null,
          isbn13: book.isbn.length === 13 ? book.isbn : null,
          sourceUrl: book.sourceUrl,
          format:
            book.format === 'EBOOK' ? BookFormat.EBOOK : BookFormat.PHYSICAL,
          coverKey: cover?.key,
          coverMime: cover?.mime,
          coverWidth: cover?.width,
          coverHeight: cover?.height,
          genres: { create: genreIds.map((genreId) => ({ genreId })) },
        },
      })
      await tx.auditLog.create({
        data: {
          actorType: ActorType.USER,
          actorId: user.id,
          action: 'BOOK_CREATED',
          targetType: 'Book',
          targetId: created.id,
          libraryId,
          summary: { isbn: book.isbn, source: 'kyobo' },
        },
      })
      return created.id
    })
    return { status: 'created', bookId, libraryId }
  } catch {
    await removeCover(cover?.key).catch((error) =>
      console.error('Cover cleanup failed', error),
    )
    return { status: 'error', error: 'saveFailed' }
  }
}
