// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IsbnScanner } from '@/components/isbn-scanner'
import { LocaleProvider } from '@/components/locale-provider'

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints() {
      return new Promise(() => {})
    }
  },
}))

afterEach(cleanup)

describe('IsbnScanner', () => {
  it('renders an icon-only localized close control', () => {
    const onClose = vi.fn()
    render(
      <LocaleProvider language="EN">
        <IsbnScanner onDetected={vi.fn()} onClose={onClose} />
      </LocaleProvider>,
    )

    const close = screen.getByRole('button', { name: 'Close camera' })
    expect(close).not.toHaveTextContent('Close camera')
    expect(close.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(close.querySelector('svg')).toHaveAttribute('focusable', 'false')

    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
