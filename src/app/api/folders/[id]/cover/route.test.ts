import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  requireLibraryAccess: vi.fn(),
  findFolder: vi.fn(),
  readCover: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }))
vi.mock('@/lib/access', () => ({
  requireLibraryAccess: mocks.requireLibraryAccess,
}))
vi.mock('@/lib/covers', () => ({ readCover: mocks.readCover }))
vi.mock('@/lib/db', () => ({
  db: { libraryFolder: { findUnique: mocks.findFolder } },
}))

import { GET } from '@/app/api/folders/[id]/cover/route'

const context = { params: Promise.resolve({ id: 'folder-1' }) }

describe('folder cover route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentUser.mockResolvedValue({ id: 'user-1' })
    mocks.findFolder.mockResolvedValue({
      libraryId: 'library-1',
      customCoverKey: 'cover.jpg',
      customCoverMime: 'image/jpeg',
    })
    mocks.readCover.mockResolvedValue(Buffer.from('image'))
  })

  it('serves a protected custom cover with defensive headers', async () => {
    const response = await GET(new Request('http://localhost'), context)

    expect(response.status).toBe(200)
    expect(mocks.requireLibraryAccess).toHaveBeenCalledWith(
      { id: 'user-1' },
      'library-1',
      'READ',
    )
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('content-length')).toBe('5')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it.each(['anonymous', 'unauthorized', 'missing-file'])(
    'returns a non-disclosing response for %s access',
    async (scenario) => {
      if (scenario === 'anonymous') mocks.currentUser.mockResolvedValue(null)
      if (scenario === 'unauthorized')
        mocks.requireLibraryAccess.mockRejectedValue(new Error('denied'))
      if (scenario === 'missing-file')
        mocks.readCover.mockRejectedValue(new Error('missing'))

      const response = await GET(new Request('http://localhost'), context)

      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Not found')
    },
  )
})
