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
    expect(passwordChangeError({ ...valid, newPassword: 'short' })).toMatch(
      /between 12 and 128/,
    )
    expect(
      passwordChangeError({ ...valid, confirmation: 'different-password' }),
    ).toMatch(/does not match/)
  })

  it('requires the current password and a changed value', () => {
    expect(passwordChangeError({ ...valid, currentMatches: false })).toMatch(
      /incorrect/,
    )
    expect(passwordChangeError({ ...valid, newMatchesCurrent: true })).toMatch(
      /must be different/,
    )
  })
})
