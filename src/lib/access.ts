import type { MemberRole, User } from '@prisma/client'
import { db } from '@/lib/db'

export type LibraryAccess = 'OWNER' | MemberRole

export async function libraryAccess(
  userId: string,
  libraryId: string,
): Promise<LibraryAccess | null> {
  const library = await db.library.findUnique({
    where: { id: libraryId },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  })
  if (!library) return null
  if (library.ownerId === userId) return 'OWNER'
  return library.members[0]?.role ?? null
}

export async function requireLibraryAccess(
  user: Pick<User, 'id'>,
  libraryId: string,
  level: 'READ' | 'WRITE' | 'OWNER',
) {
  const access = await libraryAccess(user.id, libraryId)
  const permitted =
    access &&
    (level === 'READ' ||
      access === 'OWNER' ||
      (level === 'WRITE' && access === 'EDITOR'))
  if (!permitted) throw new Error('Library not found or access denied')
  return access
}

export async function requireBookAccess(
  user: Pick<User, 'id'>,
  bookId: string,
  level: 'READ' | 'WRITE',
) {
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { libraryId: true },
  })
  if (!book) throw new Error('Book not found')
  await requireLibraryAccess(user, book.libraryId, level)
  return book
}
