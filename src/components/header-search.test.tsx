// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeaderSearch } from '@/components/header-search'
import { LocaleProvider } from '@/components/locale-provider'
import type { AppLanguage } from '@/lib/i18n/config'

const navigation = vi.hoisted(() => ({
  pathname: '/search',
  params: new URLSearchParams('q=Dune&source=library'),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
  useRouter: () => ({ push: navigation.push }),
}))

vi.mock('@/components/isbn-scanner', () => ({
  IsbnScanner: ({
    onDetected,
    onClose,
  }: {
    onDetected: (isbn: string) => void
    onClose: () => void
  }) => (
    <div>
      <button type="button" onClick={() => onDetected('9781234567890')}>
        Detect ISBN
      </button>
      <button type="button" onClick={onClose}>
        Close camera
      </button>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
  navigation.pathname = '/search'
  navigation.params = new URLSearchParams('q=Dune&source=library')
  navigation.push.mockReset()
})

function renderSearch(authenticated: boolean, language: AppLanguage = 'KO') {
  return render(
    <LocaleProvider language={language}>
      <HeaderSearch authenticated={authenticated} />
    </LocaleProvider>,
  )
}

describe('HeaderSearch', () => {
  it('renders retained signed-in GET controls in the requested order', () => {
    const { container } = renderSearch(true)
    const form = container.querySelector('form')!
    const query = screen.getByLabelText('책 검색')
    const source = screen.getByLabelText('검색 대상')
    const submit = screen.getByRole('button', { name: '검색' })

    expect(form).toHaveAttribute('action', '/search')
    expect(form).not.toHaveAttribute('method', 'post')
    expect(query).toHaveAttribute('name', 'q')
    expect(query).toHaveValue('Dune')
    expect(source).toHaveAttribute('name', 'source')
    expect(source).toHaveValue('library')
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['전체', '교보문고', '서재'])
    expect(query.compareDocumentPosition(source)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(source.compareDocumentPosition(submit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(submit).not.toHaveTextContent('검색')
    expect(submit.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(submit.querySelector('svg')).toHaveAttribute('focusable', 'false')
  })

  it('opens the mobile scanner and searches with the selected source', () => {
    const { container } = renderSearch(true)
    const camera = screen.getByRole('button', { name: 'ISBN 스캔' })
    expect(camera).toHaveClass('sm:hidden')
    expect(camera).not.toHaveTextContent('스캔')
    expect(camera.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    fireEvent.click(camera)
    const dialog = screen.getByRole('dialog', { name: 'ISBN 스캔' })
    expect(dialog).toBeVisible()
    expect(dialog.parentElement).toBe(document.body)
    expect(container.querySelector('#header-scanner-dialog')).toBeNull()
    expect(dialog).toHaveClass('h-[100dvh]', 'overflow-y-auto')
    expect(dialog.querySelector('#header-scanner-panel')).toHaveClass(
      'mx-auto',
      'my-auto',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Detect ISBN' }))

    expect(navigation.push).toHaveBeenCalledWith(
      '/search?q=9781234567890&source=library',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('forces anonymous searches and scans to Kyobo', () => {
    navigation.params = new URLSearchParams('q=Dune&source=library')
    const { container } = renderSearch(false)

    expect(screen.queryByLabelText('검색 대상')).not.toBeInTheDocument()
    expect(container.querySelector('input[name="source"]')).toHaveValue('kyobo')
    expect(container.querySelector('#header-search-source')).toHaveTextContent(
      '교보문고',
    )
    fireEvent.click(screen.getByRole('button', { name: 'ISBN 스캔' }))
    fireEvent.click(screen.getByRole('button', { name: 'Detect ISBN' }))
    expect(navigation.push).toHaveBeenCalledWith(
      '/search?q=9781234567890&source=kyobo',
    )
  })

  it('renders English search controls', () => {
    renderSearch(true, 'EN')

    expect(screen.getByLabelText('Search books')).toHaveAttribute(
      'placeholder',
      'Title, author, or ISBN',
    )
    expect(screen.getByLabelText('Search source')).toBeInTheDocument()
    const search = screen.getByRole('button', { name: 'Search' })
    const scan = screen.getByRole('button', { name: 'Scan ISBN' })
    expect(search).not.toHaveTextContent('Search')
    expect(scan).not.toHaveTextContent('Scan')
    expect(search.querySelector('svg')).toBeInTheDocument()
    expect(scan.querySelector('svg')).toBeInTheDocument()
  })
})
