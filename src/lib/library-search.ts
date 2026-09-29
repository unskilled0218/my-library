import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export const GLOBAL_LIBRARY_RESULT_LIMIT = 50

export function globalLibraryBookWhere(
  userId: string,
  query: string,
): Prisma.BookWhereInput {
  return {
    library: {
      is: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    },
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { comment: { contains: query, mode: 'insensitive' } },
      { authors: { has: query } },
      { isbn10: { contains: query } },
      { isbn13: { contains: query } },
      {
        genres: {
          some: { genre: { name: { contains: query, mode: 'insensitive' } } },
        },
      },
      {
        locationTag: {
          is: { name: { contains: query, mode: 'insensitive' } },
        },
      },
    ],
  }
}

export async function searchReadableLibraryBooks(
  userId: string,
  query: string,
) {
  const books = await db.book.findMany({
    where: globalLibraryBookWhere(userId, query),
    include: {
      library: { select: { id: true, name: true } },
      locationTag: true,
      genres: { include: { genre: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: GLOBAL_LIBRARY_RESULT_LIMIT + 1,
  })
  return {
    books: books.slice(0, GLOBAL_LIBRARY_RESULT_LIMIT),
    truncated: books.length > GLOBAL_LIBRARY_RESULT_LIMIT,
  }
}

export async function writableLibraryDestinations(userId: string) {
  return db.library.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, role: 'EDITOR' } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  })
}
