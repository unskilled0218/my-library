import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireLibraryAccess: vi.fn(),
  folderFindFirst: vi.fn(),
  folderFindUnique: vi.fn(),
  folderFindMany: vi.fn(),
  folderCreate: vi.fn(),
  folderUpdate: vi.fn(),
  folderDelete: vi.fn(),
  folderCount: vi.fn(),
  bookFindFirst: vi.fn(),
  bookCount: vi.fn(),
  auditCreate: vi.fn(),
  queryRaw: vi.fn(),
  removeCover: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/access', () => ({
  requireLibraryAccess: mocks.requireLibraryAccess,
}))
vi.mock('@/lib/covers', () => ({
  downloadCover: vi.fn(),
  saveCoverData: vi.fn(),
  removeCover: mocks.removeCover,
}))
vi.mock('@/lib/book-files', () => ({ removeBookFile: vi.fn() }))
vi.mock('@/lib/genres', () => ({ upsertGenrePaths: vi.fn() }))
vi.mock('@/lib/kyobo', () => ({ getKyoboBook: vi.fn() }))
vi.mock('@/lib/i18n/cookie', () => ({ setLanguageCookie: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ assertRateLimit: vi.fn() }))
vi.mock('@/lib/db', () => {
  const tx = {
    $queryRaw: mocks.queryRaw,
    libraryFolder: {
      create: mocks.folderCreate,
      update: mocks.folderUpdate,
      delete: mocks.folderDelete,
      count: mocks.folderCount,
      findMany: mocks.folderFindMany,
    },
    book: { count: mocks.bookCount },
    auditLog: { create: mocks.auditCreate },
  }
  return {
    db: {
      libraryFolder: {
        findFirst: mocks.folderFindFirst,
        findUnique: mocks.folderFindUnique,
        findMany: mocks.folderFindMany,
      },
      book: { findFirst: mocks.bookFindFirst },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    },
  }
})

import {
  createFolderAction,
  deleteFolderAction,
  updateFolderAction,
} from '@/app/actions'

describe('folder actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 'user-1' })
    mocks.requireLibraryAccess.mockResolvedValue('OWNER')
    mocks.folderFindFirst.mockResolvedValue(null)
    mocks.folderCreate.mockResolvedValue({ id: 'folder-1' })
    mocks.auditCreate.mockResolvedValue({})
    mocks.removeCover.mockResolvedValue(undefined)
  })

  it('creates a root folder and records an audit event', async () => {
    const form = new FormData()
    form.set('libraryId', 'library-1')
    form.set('title', '  Reading  ')
    form.set('coverMode', 'none')

    await expect(createFolderAction(form)).rejects.toThrow(
      'REDIRECT:/libraries/library-1?folder=folder-1',
    )

    expect(mocks.folderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        libraryId: 'library-1',
        parentId: null,
        title: 'Reading',
      }),
    })
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'FOLDER_CREATED' }),
    })
  })

  it('rejects moving a folder into a descendant', async () => {
    mocks.folderFindUnique.mockResolvedValue({
      id: 'folder-1',
      title: 'Parent',
      libraryId: 'library-1',
      parentId: null,
      customCoverKey: null,
    })
    mocks.folderFindMany.mockResolvedValue([
      { id: 'folder-1', title: 'Parent', parentId: null },
      { id: 'folder-2', title: 'Child', parentId: 'folder-1' },
    ])
    const form = new FormData()
    form.set('folderId', 'folder-1')
    form.set('title', 'Parent')
    form.set('parentId', 'folder-2')

    await expect(updateFolderAction(form)).rejects.toThrow('descendant')
    expect(mocks.folderUpdate).not.toHaveBeenCalled()
  })

  it('refuses to delete a non-empty folder', async () => {
    mocks.folderFindUnique.mockResolvedValue({
      id: 'folder-1',
      title: 'Parent',
      libraryId: 'library-1',
      parentId: null,
      customCoverKey: null,
    })
    mocks.folderCount.mockResolvedValue(1)
    mocks.bookCount.mockResolvedValue(0)
    const form = new FormData()
    form.set('folderId', 'folder-1')

    await expect(deleteFolderAction(form)).rejects.toThrow('must be empty')
    expect(mocks.folderDelete).not.toHaveBeenCalled()
  })
})
