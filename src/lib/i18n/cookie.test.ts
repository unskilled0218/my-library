import { describe, expect, it, vi } from 'vitest'

const set = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ set }),
}))

import { setLanguageCookie } from '@/lib/i18n/cookie'

describe('language cookie', () => {
  it('writes a durable non-sensitive root cookie', async () => {
    await setLanguageCookie('EN')

    expect(set).toHaveBeenCalledWith('my_library_language', 'EN', {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 31_536_000,
    })
  })
})
