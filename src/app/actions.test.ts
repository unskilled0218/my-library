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
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}))
vi.mock('@/lib/access', () => ({
  requireLibraryAccess: vi.fn().mockResolvedValue('OWNER'),
}))
vi.mock('@/lib/db', () => ({
  db: {
    book: { findFirst: mocks.findFirst },
    userDisplaySettings: { upsert: mocks.upsertSettings },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        book: { create: mocks.createBook },
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

import { addKyoboBookAction, updateLanguageAction } from '@/app/actions'

describe('addKyoboBookAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getKyoboBook.mockResolvedValue({
      saleId: 'S000001772370',
      title: 'Dune',
      authors: ['Frank Herbert'],
      isbn: '9791158887544',
      sourceUrl: 'https://product.kyobobook.co.kr/detail/S000001772370',
      format: 'PHYSICAL',
      coverUrl: null,
      description: '',
      genrePaths: [],
    })
  })

  it('returns to the review with a useful message when the book exists', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'book-1' })
    const form = new FormData()
    form.set('libraryId', 'library-1')
    form.set('saleId', 'S000001772370')
    form.set('q', 'Dune')
    form.set('source', 'all')

    await expect(addKyoboBookAction(form)).rejects.toThrow('REDIRECT:')

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
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/search?q=Dune&source=all&selected=S000001772370&libraryId=library-1&status=already-exists',
    )
    expect(mocks.downloadCover).not.toHaveBeenCalled()
  })

  it('keeps the search view and offers the destination after adding', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const form = new FormData()
    form.set('libraryId', 'library-1')
    form.set('saleId', 'S000001772370')
    form.set('q', 'Dune')
    form.set('source', 'kyobo')

    await expect(addKyoboBookAction(form)).rejects.toThrow('REDIRECT:')

    expect(mocks.createBook).toHaveBeenCalledOnce()
    expect(mocks.createAudit).toHaveBeenCalledOnce()
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/libraries/library-1')
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/search?q=Dune&source=kyobo&libraryId=library-1&status=added',
    )
  })
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
