import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireBookAccess: vi.fn(),
  requireLibraryAccess: vi.fn(),
  bookFind: vi.fn(),
  booksFind: vi.fn(),
  bookDelete: vi.fn(),
  libraryDelete: vi.fn(),
  auditCreate: vi.fn(),
  queryRaw: vi.fn(),
  removeCover: vi.fn(),
  removeBookFile: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireUser: mocks.requireUser,
  currentAdmin: vi.fn(),
  requireAdmin: vi.fn(),
}))
vi.mock('@/lib/access', () => ({
  requireBookAccess: mocks.requireBookAccess,
  requireLibraryAccess: mocks.requireLibraryAccess,
}))
vi.mock('@/lib/covers', () => ({
  downloadCover: vi.fn(),
  removeCover: mocks.removeCover,
}))
vi.mock('@/lib/book-files', () => ({
  removeBookFile: mocks.removeBookFile,
}))
vi.mock('@/lib/db', () => ({
  db: {
    book: {
      findUniqueOrThrow: mocks.bookFind,
      findMany: mocks.booksFind,
      delete: mocks.bookDelete,
    },
    library: { delete: mocks.libraryDelete },
    auditLog: { create: mocks.auditCreate },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.queryRaw,
        auditLog: { create: mocks.auditCreate },
        book: {
          findUniqueOrThrow: mocks.bookFind,
          findMany: mocks.booksFind,
          delete: mocks.bookDelete,
        },
        library: { delete: mocks.libraryDelete },
      }),
  },
}))
vi.mock('@/lib/genres', () => ({ upsertGenrePaths: vi.fn() }))
vi.mock('@/lib/kyobo', () => ({ getKyoboBook: vi.fn() }))
vi.mock('@/lib/i18n/cookie', () => ({ setLanguageCookie: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ assertRateLimit: vi.fn() }))

import { deleteBookAction, deleteLibraryAction } from '@/app/actions'

describe('book file deletion cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 'user-1' })
    mocks.requireBookAccess.mockResolvedValue({ libraryId: 'library-1' })
    mocks.requireLibraryAccess.mockResolvedValue('OWNER')
    mocks.auditCreate.mockResolvedValue({})
    mocks.bookDelete.mockResolvedValue({})
    mocks.libraryDelete.mockResolvedValue({})
    mocks.queryRaw.mockResolvedValue([])
    mocks.removeCover.mockResolvedValue(undefined)
    mocks.removeBookFile.mockResolvedValue(undefined)
  })

  it('removes all attachment bytes after deleting a book', async () => {
    mocks.bookFind.mockResolvedValue({
      coverKey: 'cover.jpg',
      files: [{ storageKey: 'book.epub' }, { storageKey: 'book.pdf' }],
    })
    const form = new FormData()
    form.set('bookId', 'book-1')

    await expect(deleteBookAction(form)).rejects.toThrow(
      'REDIRECT:/libraries/library-1',
    )

    expect(mocks.removeCover).toHaveBeenCalledWith('cover.jpg')
    expect(mocks.removeBookFile).toHaveBeenCalledWith('book.epub')
    expect(mocks.removeBookFile).toHaveBeenCalledWith('book.pdf')
  })

  it('removes every attachment after deleting a library', async () => {
    mocks.booksFind.mockResolvedValue([
      {
        coverKey: null,
        files: [{ storageKey: 'one.epub' }, { storageKey: 'one.pdf' }],
      },
      { coverKey: 'two.jpg', files: [{ storageKey: 'two.pdf' }] },
    ])
    const form = new FormData()
    form.set('libraryId', 'library-1')

    await expect(deleteLibraryAction(form)).rejects.toThrow(
      'REDIRECT:/libraries',
    )

    expect(mocks.removeBookFile.mock.calls.flat()).toEqual([
      'one.epub',
      'one.pdf',
      'two.pdf',
    ])
  })
})
