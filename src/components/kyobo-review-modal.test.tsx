// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KyoboReviewModal } from '@/components/kyobo-review-modal'

const push = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

afterEach(() => {
  cleanup()
  push.mockReset()
})

describe('KyoboReviewModal', () => {
  it('focuses close and supports link, Escape, and backdrop dismissal', () => {
    const closeHref = '/search?q=Dune&source=kyobo'
    render(
      <KyoboReviewModal closeHref={closeHref}>
        <p>Selected book</p>
      </KyoboReviewModal>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Kyobo book details' })
    const close = screen.getByRole('link', { name: 'Close' })
    expect(dialog).toBeVisible()
    expect(close).toHaveAttribute('href', closeHref)
    expect(close).toHaveFocus()
    expect(document.body).toHaveStyle({ overflow: 'hidden' })

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.mouseDown(dialog)
    expect(push).toHaveBeenNthCalledWith(1, closeHref)
    expect(push).toHaveBeenNthCalledWith(2, closeHref)
  })
})
