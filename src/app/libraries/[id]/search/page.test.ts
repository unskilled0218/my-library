import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  requireLibraryAccess: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}))
vi.mock('@/lib/access', () => ({
  requireLibraryAccess: mocks.requireLibraryAccess,
}))

import LegacyLibrarySearchPage from '@/app/libraries/[id]/search/page'

describe('legacy library search redirects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('authorizes before redirecting a valid selected product', async () => {
    mocks.requireLibraryAccess.mockResolvedValue('OWNER')

    await expect(
      LegacyLibrarySearchPage({
        params: Promise.resolve({ id: 'library-1' }),
        searchParams: Promise.resolve({
          q: `  ${'Dune '.repeat(30)}`,
          selected: 'S000001772370',
        }),
      }),
    ).rejects.toThrow('REDIRECT:')

    expect(mocks.requireLibraryAccess).toHaveBeenCalledOnce()
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/search\/kyobo\/S000001772370\?q=.+&source=kyobo&libraryId=library-1$/,
      ),
    )
  })

  it('drops a malformed selected value from the compatibility redirect', async () => {
    mocks.requireLibraryAccess.mockResolvedValue('EDITOR')

    await expect(
      LegacyLibrarySearchPage({
        params: Promise.resolve({ id: 'library-1' }),
        searchParams: Promise.resolve({ q: 'Dune', selected: '../admin' }),
      }),
    ).rejects.toThrow('REDIRECT:')

    expect(mocks.redirect).toHaveBeenCalledWith(
      '/search?q=Dune&source=kyobo&libraryId=library-1',
    )
  })
})
