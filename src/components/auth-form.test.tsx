// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthForm } from '@/components/auth-form'

afterEach(cleanup)

const action = vi.fn(async () => undefined)

describe('AuthForm localization', () => {
  it('uses explicit mode for Korean registration autocomplete', () => {
    render(
      <AuthForm
        id="register"
        title="무료로 가입하기"
        action={action}
        mode="register"
        language="KO"
      />,
    )

    expect(screen.getByLabelText('로그인 ID')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    expect(screen.getByRole('button', { name: '계속' })).toBeInTheDocument()
  })

  it('localizes stable English error codes and login autocomplete', () => {
    render(
      <AuthForm
        id="login"
        title="Welcome back"
        action={action}
        mode="login"
        language="EN"
        error="invalid-credentials"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials.')
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
  })
})
