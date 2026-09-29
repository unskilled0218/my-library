// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeaderSearch } from '@/components/header-search'

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

describe('HeaderSearch', () => {
  it('renders retained signed-in GET controls in the requested order', () => {
    const { container } = render(<HeaderSearch authenticated />)
    const form = container.querySelector('form')!
    const query = screen.getByLabelText('Search books')
    const source = screen.getByLabelText('Search source')
    const submit = screen.getByRole('button', { name: 'Search' })

    expect(form).toHaveAttribute('action', '/search')
    expect(form).not.toHaveAttribute('method', 'post')
    expect(query).toHaveAttribute('name', 'q')
    expect(query).toHaveValue('Dune')
    expect(source).toHaveAttribute('name', 'source')
    expect(source).toHaveValue('library')
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['All', 'Kyobo', 'Library'])
    expect(query.compareDocumentPosition(source)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(source.compareDocumentPosition(submit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('opens the mobile scanner and searches with the selected source', () => {
    render(<HeaderSearch authenticated />)
    const camera = screen.getByRole('button', { name: 'Scan ISBN' })
    expect(camera).toHaveClass('sm:hidden')

    fireEvent.click(camera)
    expect(screen.getByRole('dialog', { name: 'Scan an ISBN' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Detect ISBN' }))

    expect(navigation.push).toHaveBeenCalledWith(
      '/search?q=9781234567890&source=library',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('forces anonymous searches and scans to Kyobo', () => {
    navigation.params = new URLSearchParams('q=Dune&source=library')
    const { container } = render(<HeaderSearch authenticated={false} />)

    expect(screen.queryByLabelText('Search source')).not.toBeInTheDocument()
    expect(container.querySelector('input[name="source"]')).toHaveValue('kyobo')
    expect(container.querySelector('#header-search-source')).toHaveTextContent(
      'Kyobo',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Scan ISBN' }))
    fireEvent.click(screen.getByRole('button', { name: 'Detect ISBN' }))
    expect(navigation.push).toHaveBeenCalledWith(
      '/search?q=9781234567890&source=kyobo',
    )
  })
})
