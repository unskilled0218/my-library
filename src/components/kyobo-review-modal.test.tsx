// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KyoboReviewModal } from '@/components/kyobo-review-modal'
import { LocaleProvider } from '@/components/locale-provider'
import type { AppLanguage } from '@/lib/i18n/config'

const push = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

afterEach(() => {
  cleanup()
  push.mockReset()
})

describe('KyoboReviewModal', () => {
  function renderModal(language: AppLanguage = 'KO') {
    const closeHref = '/search?q=Dune&source=kyobo'
    render(
      <LocaleProvider language={language}>
        <KyoboReviewModal closeHref={closeHref}>
          <p>Selected book</p>
        </KyoboReviewModal>
      </LocaleProvider>,
    )
    return closeHref
  }

  it('focuses close and supports link, Escape, and backdrop dismissal', () => {
    const closeHref = renderModal()

    const dialog = screen.getByRole('dialog', {
      name: '교보문고 책 상세 정보',
    })
    const close = screen.getByRole('link', { name: '닫기' })
    expect(dialog).toBeVisible()
    expect(close).toHaveAttribute('href', closeHref)
    expect(close).toHaveFocus()
    expect(close).not.toHaveTextContent('닫기')
    expect(close.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(close.querySelector('svg')).toHaveAttribute('focusable', 'false')
    expect(document.body).toHaveStyle({ overflow: 'hidden' })

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.mouseDown(dialog)
    expect(push).toHaveBeenNthCalledWith(1, closeHref)
    expect(push).toHaveBeenNthCalledWith(2, closeHref)
  })

  it('renders English modal controls', () => {
    renderModal('EN')

    expect(
      screen.getByRole('dialog', { name: 'Kyobo book details' }),
    ).toBeVisible()
    const close = screen.getByRole('link', { name: 'Close' })
    expect(close).not.toHaveTextContent('Close')
    expect(close.querySelector('svg')).toBeInTheDocument()
  })
})
