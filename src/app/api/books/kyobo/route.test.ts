import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  save: vi.fn(),
  revalidate: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ currentUser: mocks.user }))
vi.mock('@/lib/kyobo-import', () => ({ importKyoboBook: mocks.save }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
import { POST } from './route'

function request(headers: Record<string, string> = {}, body?: string) {
  const form = new FormData()
  form.set('saleId', 'S000001772370')
  form.set('libraryId', 'library')
  return new Request('http://internal/api/books/kyobo', {
    method: 'POST',
    headers: {
      origin: 'https://books.example',
      'x-forwarded-host': 'books.example',
      'x-forwarded-proto': 'https',
      ...headers,
    },
    body: body ?? form,
  })
}

describe('Kyobo background endpoint', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.user.mockResolvedValue({ id: 'editor' })
    mocks.save.mockResolvedValue({
      status: 'created',
      bookId: 'book',
      libraryId: 'library',
    })
  })
  it('awaits an authenticated import and invalidates affected pages', async () => {
    const response = await POST(request())
    expect(await response.json()).toEqual({
      status: 'created',
      bookId: 'book',
      libraryId: 'library',
    })
    expect(mocks.save.mock.calls[0][1].get('saleId')).toBe('S000001772370')
    expect(mocks.revalidate.mock.calls).toEqual([
      ['/libraries/library'],
      ['/'],
      ['/libraries'],
    ])
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('returns an existing book without revalidation', async () => {
    mocks.save.mockResolvedValue({
      status: 'existing',
      bookId: 'book',
      libraryId: 'library',
    })
    expect(await (await POST(request())).json()).toEqual({
      status: 'existing',
      bookId: 'book',
      libraryId: 'library',
    })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it('returns JSON for expired authentication without importing', async () => {
    mocks.user.mockResolvedValue(null)
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      status: 'error',
      error: 'signInRequired',
    })
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it.each(['https://elsewhere.example', 'http://books.example', 'null', ''])(
    'rejects an invalid origin %s before authentication',
    async (origin) => {
      expect((await POST(request({ origin }))).status).toBe(403)
      expect(mocks.user).not.toHaveBeenCalled()
      expect(mocks.save).not.toHaveBeenCalled()
    },
  )
  it('supports a direct same-origin development request', async () => {
    const req = new Request('http://localhost:3100/api/books/kyobo', {
      method: 'POST',
      headers: { origin: 'http://localhost:3100' },
      body: new FormData(),
    })
    expect((await POST(req)).status).toBe(200)
  })
  it('rejects malformed form bodies without importing', async () => {
    const response = await POST(
      request({ 'content-type': 'application/json' }, '{}'),
    )
    expect(response.status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('maps domain errors without invalidating caches', async () => {
    mocks.save.mockResolvedValue({ status: 'error', error: 'accessDenied' })
    const response = await POST(request())
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      status: 'error',
      error: 'accessDenied',
    })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it('hides unexpected exception details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mocks.save.mockRejectedValue(new Error('private database error'))
      const response = await POST(request())
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({
        status: 'error',
        error: 'saveFailed',
      })
      expect(mocks.revalidate).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })
})
