import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireLibraryAccess: vi.fn(),
  library: vi.fn(),
  location: vi.fn(),
  folder: vi.fn(),
  getKyoboBook: vi.fn(),
  duplicate: vi.fn(),
  createBook: vi.fn(),
  audit: vi.fn(),
  genres: vi.fn(),
  downloadCover: vi.fn(),
  removeCover: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/access', () => ({
  requireLibraryAccess: mocks.requireLibraryAccess,
}))
vi.mock('@/lib/db', () => ({
  db: {
    library: { findUniqueOrThrow: mocks.library },
    locationTag: { findFirst: mocks.location },
    libraryFolder: { findFirst: mocks.folder },
    book: { findFirst: mocks.duplicate },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        book: { create: mocks.createBook },
        auditLog: { create: mocks.audit },
      }),
  },
}))
vi.mock('@/lib/kyobo', () => ({ getKyoboBook: mocks.getKyoboBook }))
vi.mock('@/lib/genres', () => ({ upsertGenrePaths: mocks.genres }))
vi.mock('@/lib/covers', () => ({
  downloadCover: mocks.downloadCover,
  removeCover: mocks.removeCover,
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { addKyoboBookAction } from '@/app/actions'
import { importKyoboBook } from '@/lib/kyobo-import'

const canonical = {
  saleId: 'S000001772370',
  title: 'Canonical title',
  authors: ['Canonical author'],
  description: 'Canonical description',
  isbn: '9791158887544',
  sourceUrl: 'https://product.kyobobook.co.kr/detail/S000001772370',
  format: 'PHYSICAL',
  coverUrl: 'https://contents.kyobobook.co.kr/cover.jpg',
  genrePaths: [
    [
      {
        name: 'Genre',
        url: 'https://store.kyobobook.co.kr/category/domestic/01',
      },
    ],
  ],
}
function form(values: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    saleId: canonical.saleId,
    libraryId: 'shared-library',
    q: 'Dune',
    source: 'all',
    ...values,
  }))
    data.set(key, value)
  return data
}

describe('Kyobo add-time validation and persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 'editor' })
    mocks.requireLibraryAccess.mockResolvedValue('EDITOR')
    mocks.library.mockResolvedValue({ ownerId: 'owner' })
    mocks.location.mockResolvedValue({ id: 'owners-tag' })
    mocks.folder.mockResolvedValue({ id: 'folder' })
    mocks.getKyoboBook.mockResolvedValue(canonical)
    mocks.duplicate.mockResolvedValue(null)
    mocks.createBook.mockResolvedValue({ id: 'created' })
    mocks.audit.mockResolvedValue({})
    mocks.genres.mockResolvedValue(['genre-id'])
    mocks.downloadCover.mockResolvedValue({
      key: 'new-cover.jpg',
      mime: 'image/jpeg',
      width: 100,
      height: 200,
    })
    mocks.removeCover.mockResolvedValue(undefined)
  })

  it('returns the created identifiers from the shared service without navigation', async () => {
    expect(await importKyoboBook({ id: 'editor' }, form())).toEqual({
      status: 'created',
      bookId: 'created',
      libraryId: 'shared-library',
    })
    expect(mocks.audit).toHaveBeenCalledOnce()
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('returns a destination-authorized existing book without writing or applying retry options', async () => {
    mocks.duplicate.mockResolvedValueOnce({ id: 'existing' })
    expect(
      await importKyoboBook(
        { id: 'editor' },
        form({ comment: 'Do not replace' }),
      ),
    ).toEqual({
      status: 'existing',
      bookId: 'existing',
      libraryId: 'shared-library',
    })
    expect(mocks.requireLibraryAccess).toHaveBeenCalledWith(
      { id: 'editor' },
      'shared-library',
      'WRITE',
    )
    expect(mocks.duplicate.mock.calls[0][0].where.libraryId).toBe(
      'shared-library',
    )
    expect(mocks.createBook).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
    expect(mocks.downloadCover).not.toHaveBeenCalled()
  })

  it('saves canonical metadata and all user options with owner-scoped tags and an initial folder', async () => {
    const data = form({
      title: 'Forged',
      authors: 'Forged author',
      format: 'EBOOK',
      ownershipState: 'DONT_HAVE',
      locationTagId: 'owners-tag',
      folderId: 'folder',
      readingState: 'DONE',
      readingStartedAt: '2024-01-01',
      readingFinishedAt: '2024-02-01',
      rating: '4',
      comment: 'My comment',
    })
    await expect(addKyoboBookAction(data)).rejects.toThrow(
      'REDIRECT:/search?q=Dune&source=all&libraryId=shared-library&status=added',
    )
    expect(mocks.location).toHaveBeenCalledWith({
      where: { id: 'owners-tag', userId: 'owner' },
      select: { id: true },
    })
    expect(mocks.folder).toHaveBeenCalledWith({
      where: { id: 'folder', libraryId: 'shared-library' },
      select: { id: true },
    })
    expect(mocks.createBook).toHaveBeenCalledWith({
      data: expect.objectContaining({
        libraryId: 'shared-library',
        title: canonical.title,
        authors: canonical.authors,
        description: canonical.description,
        format: 'PHYSICAL',
        isbn10: null,
        isbn13: canonical.isbn,
        ownershipState: 'DONT_HAVE',
        locationTagId: 'owners-tag',
        folderId: 'folder',
        readingState: 'DONE',
        readingStartedAt: new Date('2024-01-01T00:00:00Z'),
        readingFinishedAt: new Date('2024-02-01T00:00:00Z'),
        rating: 4,
        comment: 'My comment',
        coverKey: 'new-cover.jpg',
        genres: { create: [{ genreId: 'genre-id' }] },
      }),
    })
    expect(mocks.audit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'BOOK_CREATED',
          targetId: 'created',
        }),
      }),
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/libraries/shared-library',
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/libraries')
  })

  it.each(['1234567890', '9791158887544'])(
    'stores the canonical ISBN %s in the correct field',
    async (isbn) => {
      mocks.getKyoboBook.mockResolvedValue({ ...canonical, isbn })
      await expect(addKyoboBookAction(form())).rejects.toThrow('REDIRECT:')
      expect(mocks.createBook.mock.calls[0][0].data).toMatchObject({
        isbn10: isbn.length === 10 ? isbn : null,
        isbn13: isbn.length === 13 ? isbn : null,
      })
    },
  )

  it('clears a valid physical location when canonical data identifies an ebook', async () => {
    mocks.getKyoboBook.mockResolvedValue({ ...canonical, format: 'EBOOK' })
    await expect(
      addKyoboBookAction(form({ locationTagId: 'owners-tag' })),
    ).rejects.toThrow('REDIRECT:')
    expect(mocks.createBook.mock.calls[0][0].data).toMatchObject({
      format: 'EBOOK',
      locationTagId: null,
    })
  })

  it.each([
    [{ saleId: 'invalid' }, 'invalidProduct'],
    [{ ownershipState: 'INVALID' }, 'invalidOwnership'],
    [{ rating: '6' }, 'invalidRating'],
    [{ readingStartedAt: '2026-02-30' }, 'invalidDate'],
  ])(
    'rejects invalid input before retrieving or saving',
    async (values, error) => {
      expect(await addKyoboBookAction(form(values))).toEqual({ error })
      expect(mocks.getKyoboBook).not.toHaveBeenCalled()
      expect(mocks.createBook).not.toHaveBeenCalled()
    },
  )

  it('preserves the authentication redirect without scraping', async () => {
    mocks.requireUser.mockRejectedValueOnce(new Error('REDIRECT:/login'))
    await expect(addKyoboBookAction(form())).rejects.toThrow('REDIRECT:/login')
    expect(mocks.getKyoboBook).not.toHaveBeenCalled()
    expect(mocks.createBook).not.toHaveBeenCalled()
  })

  it.each(['VIEWER', 'unrelated'])(
    'rejects %s access before scraping',
    async () => {
      mocks.requireLibraryAccess.mockRejectedValueOnce(
        new Error('Access denied'),
      )
      expect(await addKyoboBookAction(form())).toEqual({
        error: 'accessDenied',
      })
      expect(mocks.getKyoboBook).not.toHaveBeenCalled()
      expect(mocks.createBook).not.toHaveBeenCalled()
    },
  )

  it.each(['location', 'folder'] as const)(
    'rejects a foreign %s before scraping',
    async (kind) => {
      mocks[kind].mockResolvedValueOnce(null)
      expect(
        await addKyoboBookAction(
          form({ locationTagId: 'owners-tag', folderId: 'folder' }),
        ),
      ).toEqual({
        error: kind === 'location' ? 'invalidLocation' : 'invalidFolder',
      })
      expect(mocks.getKyoboBook).not.toHaveBeenCalled()
      expect(mocks.createBook).not.toHaveBeenCalled()
    },
  )

  it('returns fetch failure without downloading a cover or saving preview metadata', async () => {
    mocks.getKyoboBook.mockRejectedValueOnce(new Error('Kyobo unavailable'))
    expect(await addKyoboBookAction(form({ title: 'Preview only' }))).toEqual({
      error: 'detailsUnavailable',
    })
    expect(mocks.downloadCover).not.toHaveBeenCalled()
    expect(mocks.createBook).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('leaves duplicates unchanged even when the new form has different options', async () => {
    mocks.duplicate.mockResolvedValueOnce({ id: 'existing' })
    expect(
      await addKyoboBookAction(
        form({ ownershipState: 'DONT_HAVE', comment: 'Replace?' }),
      ),
    ).toEqual({ error: 'alreadyExists' })
    expect(mocks.createBook).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
    expect(mocks.downloadCover).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('cleans up downloaded cover bytes and returns inline failure when the transaction fails', async () => {
    mocks.createBook.mockRejectedValueOnce(new Error('Transaction failed'))
    expect(await addKyoboBookAction(form())).toEqual({ error: 'saveFailed' })
    expect(mocks.removeCover).toHaveBeenCalledWith('new-cover.jpg')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('retains the existing best-effort cover behavior', async () => {
    mocks.downloadCover.mockRejectedValueOnce(new Error('Cover unavailable'))
    await expect(addKyoboBookAction(form())).rejects.toThrow('REDIRECT:')
    expect(mocks.createBook.mock.calls[0][0].data.coverKey).toBeUndefined()
  })
})
