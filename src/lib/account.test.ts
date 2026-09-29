import { describe, expect, it } from 'vitest'
import { passwordChangeError } from '@/lib/account'

const valid = {
  currentMatches: true,
  newMatchesCurrent: false,
  newPassword: 'a-new-secure-password',
  confirmation: 'a-new-secure-password',
}

describe('passwordChangeError', () => {
  it('accepts a valid password change', () => {
    expect(passwordChangeError(valid)).toBeNull()
  })

  it('enforces policy and confirmation', () => {
    expect(passwordChangeError({ ...valid, newPassword: 'short' })).toBe(
      'password-length',
    )
    expect(
      passwordChangeError({ ...valid, confirmation: 'different-password' }),
    ).toBe('password-mismatch')
  })

  it('requires the current password and a changed value', () => {
    expect(passwordChangeError({ ...valid, currentMatches: false })).toBe(
      'password-incorrect',
    )
    expect(passwordChangeError({ ...valid, newMatchesCurrent: true })).toBe(
      'password-different',
    )
  })
})
