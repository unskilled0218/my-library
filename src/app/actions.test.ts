import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  getKyoboBook: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  downloadCover: vi.fn(),
  createBook: vi.fn().mockResolvedValue({ id: 'book-2' }),
  createAudit: vi.fn().mockResolvedValue({}),
  revalidatePath: vi.fn(),
  upsertSettings: vi.fn().mockResolvedValue({}),
  setLanguageCookie: vi.fn(),
  requireLibraryAccess: vi.fn().mockResolvedValue('OWNER'),
  requireBookAccess: vi.fn(),
  findLibrary: vi.fn(),
  findBook: vi.fn(),
  updateBook: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}))
vi.mock('@/lib/access', () => ({
  requireLibraryAccess: mocks.requireLibraryAccess,
  requireBookAccess: mocks.requireBookAccess,
}))
vi.mock('@/lib/db', () => ({
  db: {
    book: { findFirst: mocks.findFirst },
    library: { findUniqueOrThrow: mocks.findLibrary },
    userDisplaySettings: { upsert: mocks.upsertSettings },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        book: {
          create: mocks.createBook,
          findUniqueOrThrow: mocks.findBook,
          update: mocks.updateBook,
        },
        auditLog: { create: mocks.createAudit },
      }),
  },
}))
vi.mock('@/lib/kyobo', () => ({ getKyoboBook: mocks.getKyoboBook }))
vi.mock('@/lib/genres', () => ({
  upsertGenrePaths: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/covers', () => ({
  downloadCover: mocks.downloadCover,
  removeCover: vi.fn(),
}))
vi.mock('@/lib/i18n/cookie', () => ({
  setLanguageCookie: mocks.setLanguageCookie,
}))

import {
  addKyoboBookAction,
  updateBookAction,
  updateLanguageAction,
} from '@/app/actions'

describe('addKyoboBookAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findLibrary.mockResolvedValue({ ownerId: 'user-1' })
    mocks.getKyoboBook.mockResolvedValue({
      saleId: 'S000001772370',
      title: 'Dune',
      authors: ['Frank Herbert'],
      isbn: '9791158887544',
      sourceUrl: 'https://product.kyobobook.co.kr/detail/S000001772370',
      format: 'PHYSICAL',
      coverUrl: null,
      description: 'Canonical description',
      genrePaths: [],
    })
  })

  it('returns inline duplicate feedback without creating or downloading a cover', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'book-1' })
    const form = new FormData()
    form.set('libraryId', 'library-1')
    form.set('saleId', 'S000001772370')
    form.set('q', 'Dune')
    form.set('source', 'all')
    form.set('title', 'Untrusted title')
    form.append('author', 'Untrusted author')
    form.set('isbn', '9791158887544')
    form.set('format', 'PHYSICAL')
    form.set('category', 'Untrusted category')
    form.set('publisher', 'Untrusted publisher')
    form.set('salePrice', '18000')
    form.set('description', 'Untrusted description')

    await expect(addKyoboBookAction(form)).resolves.toEqual({
      error: 'alreadyExists',
    })

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        libraryId: 'library-1',
        OR: [
          { isbn13: '9791158887544' },
          {
            sourceUrl: 'https://product.kyobobook.co.kr/detail/S000001772370',
          },
        ],
      },
      select: { id: true },
    })
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(mocks.createBook).not.toHaveBeenCalled()
    expect(mocks.downloadCover).not.toHaveBeenCalled()
  })

  it('keeps the search view and offers the destination after adding', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const form = new FormData()
    form.set('libraryId', 'library-1')
    form.set('saleId', 'S000001772370')
    form.set('q', 'Dune')
    form.set('source', 'kyobo')
    form.set('title', 'A forged preview title')
    form.append('author', 'A forged author')
    form.set('isbn', '1234567890')
    form.set('format', 'EBOOK')
    form.set('description', 'A forged description')
    form.set('salePrice', '1')

    await expect(addKyoboBookAction(form)).rejects.toThrow('REDIRECT:')

    expect(mocks.createBook).toHaveBeenCalledOnce()
    expect(mocks.createBook).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Dune',
          authors: ['Frank Herbert'],
          isbn13: '9791158887544',
          format: 'PHYSICAL',
          description: 'Canonical description',
        }),
      }),
    )
    expect(mocks.createAudit).toHaveBeenCalledOnce()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/libraries/library-1')
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/search?q=Dune&source=kyobo&libraryId=library-1&status=added',
    )
  })

  it('rejects a forged destination before scraping Kyobo', async () => {
    mocks.requireLibraryAccess.mockRejectedValueOnce(new Error('Access denied'))
    const form = new FormData()
    form.set('libraryId', 'forged-library')
    form.set('saleId', 'S000001772370')

    await expect(addKyoboBookAction(form)).resolves.toEqual({
      error: 'accessDenied',
    })

    expect(mocks.getKyoboBook).not.toHaveBeenCalled()
  })
})

describe('updateBookAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireBookAccess.mockResolvedValue({ libraryId: 'library-1' })
    mocks.findLibrary.mockResolvedValue({ ownerId: 'user-1' })
    mocks.findBook.mockResolvedValue({ folderId: null })
    mocks.updateBook.mockResolvedValue({ id: 'book-1' })
  })

  it.each(['missing', 'forged'])(
    'saves editable details without changing title or authors when metadata is %s',
    async (metadata) => {
      const form = new FormData()
      form.set('bookId', 'book-1')
      form.set('comment', 'My updated notes')
      form.set('rating', '4')
      form.set('ownershipState', 'DONT_HAVE')
      if (metadata === 'forged') {
        form.set('title', 'Replacement title')
        form.set('authors', 'Replacement author, Another author')
      }

      await updateBookAction(form)

      expect(mocks.requireBookAccess).toHaveBeenCalledWith(
        { id: 'user-1' },
        'book-1',
        'WRITE',
      )
      const update = mocks.updateBook.mock.calls[0][0]
      expect(update.where).toEqual({ id: 'book-1' })
      expect(update.data).not.toHaveProperty('title')
      expect(update.data).not.toHaveProperty('authors')
      expect(update.data).toMatchObject({
        comment: 'My updated notes',
        rating: 4,
        ownershipState: 'DONT_HAVE',
      })
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/books/book-1')
    },
  )
})

describe('updateLanguageAction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists English, mirrors the cookie, and revalidates the shell', async () => {
    const form = new FormData()
    form.set('language', 'EN')

    await expect(updateLanguageAction(form)).rejects.toThrow('REDIRECT:')

    expect(mocks.upsertSettings).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', language: 'EN' },
      update: { language: 'EN' },
    })
    expect(mocks.setLanguageCookie).toHaveBeenCalledWith('EN')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/settings?status=language-updated',
    )
  })

  it('rejects unsupported language values without writing', async () => {
    const form = new FormData()
    form.set('language', 'FR')

    await expect(updateLanguageAction(form)).rejects.toThrow('REDIRECT:')

    expect(mocks.redirect).toHaveBeenCalledWith(
      '/settings?error=invalid-language',
    )
    expect(mocks.upsertSettings).not.toHaveBeenCalled()
  })
})
