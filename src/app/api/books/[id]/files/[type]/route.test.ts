import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  requireBookAccess: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  auditCreate: vi.fn(),
  bookFind: vi.fn(),
  queryRaw: vi.fn(),
  transaction: vi.fn(),
  readBookFile: vi.fn(),
  saveBookFile: vi.fn(),
  removeBookFile: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }))
vi.mock('@/lib/access', () => ({
  requireBookAccess: mocks.requireBookAccess,
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/book-files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/book-files')>()),
  readBookFile: mocks.readBookFile,
  saveBookFile: mocks.saveBookFile,
  removeBookFile: mocks.removeBookFile,
}))
vi.mock('@/lib/db', () => ({
  db: {
    bookFile: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}))

import { DELETE, GET, POST } from '@/app/api/books/[id]/files/[type]/route'

const context = (type = 'PDF') => ({
  params: Promise.resolve({ id: 'book-1', type }),
})

describe('book file route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentUser.mockResolvedValue({ id: 'user-1' })
    mocks.requireBookAccess.mockResolvedValue({ libraryId: 'library-1' })
    mocks.bookFind.mockResolvedValue({ libraryId: 'library-1' })
    mocks.queryRaw.mockResolvedValue([])
    mocks.auditCreate.mockResolvedValue({})
    mocks.upsert.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
    mocks.removeBookFile.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: mocks.queryRaw,
        bookFile: {
          findUnique: mocks.findUnique,
          upsert: mocks.upsert,
          delete: mocks.delete,
        },
        auditLog: { create: mocks.auditCreate },
        book: { findUniqueOrThrow: mocks.bookFind },
      }),
    )
  })

  it('conceals unauthenticated and invalid-type requests', async () => {
    mocks.currentUser.mockResolvedValue(null)
    expect((await GET(new Request('http://app'), context())).status).toBe(404)
    mocks.currentUser.mockResolvedValue({ id: 'user-1' })
    expect((await GET(new Request('http://app'), context('EXE'))).status).toBe(
      404,
    )
  })

  it('conceals a book when library access is denied', async () => {
    mocks.requireBookAccess.mockRejectedValue(new Error('denied'))

    const response = await GET(new Request('http://app'), context())

    expect(response.status).toBe(404)
    expect(mocks.findUnique).not.toHaveBeenCalled()
  })

  it('serves an authorized file as a protected attachment', async () => {
    mocks.findUnique.mockResolvedValue({
      storageKey: '00000000-0000-0000-0000-000000000000.pdf',
      originalName: '한글 book.pdf',
      mime: 'application/pdf',
    })
    mocks.readBookFile.mockResolvedValue(Buffer.from('%PDF-file'))

    const response = await GET(new Request('http://app'), context())

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('attachment;')
    expect(response.headers.get('content-disposition')).toContain(
      "filename*=UTF-8''",
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.text()).toBe('%PDF-file')
    expect(mocks.requireBookAccess).toHaveBeenCalledWith(
      { id: 'user-1' },
      'book-1',
      'READ',
    )
  })

  it('replaces one slot transactionally and cleans the old file', async () => {
    mocks.saveBookFile.mockResolvedValue({
      storageKey: 'new.pdf',
      originalName: 'new.pdf',
      mime: 'application/pdf',
      size: 12,
    })
    mocks.findUnique.mockResolvedValue({ storageKey: 'old.pdf' })
    const form = new FormData()
    form.set(
      'file',
      new File(['%PDF-1.7'], 'new.pdf', { type: 'application/pdf' }),
    )

    const response = await POST(
      new Request('http://app', { method: 'POST', body: form }),
      context(),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ uploaded: true, replaced: true })
    expect(mocks.upsert).toHaveBeenCalledOnce()
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'BOOK_FILE_REPLACED',
          summary: { type: 'PDF', size: 12 },
        }),
      }),
    )
    expect(mocks.removeBookFile).toHaveBeenCalledWith('old.pdf')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/books/book-1')
  })

  it('removes metadata and bytes for an authorized writer', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'file-1',
      storageKey: 'book.epub',
      size: 20,
    })

    const response = await DELETE(
      new Request('http://app', { method: 'DELETE' }),
      context('EPUB'),
    )

    expect(response.status).toBe(204)
    expect(mocks.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } })
    expect(mocks.removeBookFile).toHaveBeenCalledWith('book.epub')
    expect(mocks.requireBookAccess).toHaveBeenCalledWith(
      { id: 'user-1' },
      'book-1',
      'WRITE',
    )
  })

  it('removes newly written bytes when the metadata transaction fails', async () => {
    mocks.saveBookFile.mockResolvedValue({
      storageKey: 'new.pdf',
      originalName: 'new.pdf',
      mime: 'application/pdf',
      size: 12,
    })
    mocks.transaction.mockRejectedValue(new Error('database failed'))
    const form = new FormData()
    form.set(
      'file',
      new File(['%PDF-1.7'], 'new.pdf', { type: 'application/pdf' }),
    )

    await expect(
      POST(
        new Request('http://app', { method: 'POST', body: form }),
        context(),
      ),
    ).rejects.toThrow('database failed')
    expect(mocks.removeBookFile).toHaveBeenCalledWith('new.pdf')
  })
})
