import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookieValue: 'KO',
  findSettings: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: () => ({ value: mocks.cookieValue }),
  })),
}))
vi.mock('@/lib/auth', () => ({ currentUser: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({
  db: { userDisplaySettings: { findUnique: mocks.findSettings } },
}))

import { resolveLanguage } from '@/lib/i18n/server'

describe('server locale resolution', () => {
  beforeEach(() => {
    mocks.cookieValue = 'KO'
    mocks.findSettings.mockReset()
  })

  it('prefers an authenticated user setting over the cookie', async () => {
    mocks.findSettings.mockResolvedValue({ language: 'EN' })
    expect(await resolveLanguage({ id: 'user-1' })).toBe('EN')
  })

  it('uses a valid cookie for logged-out pages', async () => {
    mocks.cookieValue = 'EN'
    expect(await resolveLanguage(null)).toBe('EN')
  })

  it('falls back to Korean for malformed cookies', async () => {
    mocks.cookieValue = 'FR'
    expect(await resolveLanguage(null)).toBe('KO')
  })
})
