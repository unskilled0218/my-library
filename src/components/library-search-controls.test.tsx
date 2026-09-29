// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LibrarySearchControls } from '@/components/library-search-controls'
import { LocaleProvider } from '@/components/locale-provider'

const props = {
  query: {
    q: 'history',
    reading: 'READING',
    format: 'PHYSICAL',
    ownership: 'HAVE',
    location: 'shelf-1',
    genre: 'genre-1',
  },
  locations: [{ id: 'shelf-1', name: 'Study' }],
  genres: [{ id: 'genre-1', name: 'History' }],
}

afterEach(cleanup)

describe('LibrarySearchControls', () => {
  const renderControls = (language: 'KO' | 'EN' = 'KO') =>
    render(
      <LocaleProvider language={language}>
        <LibrarySearchControls {...props} />
      </LocaleProvider>,
    )

  it('reveals populated filters and allows them to be hidden', () => {
    renderControls('EN')

    expect(screen.getByLabelText('Reading state')).not.toBeVisible()
    expect(document.querySelector('#library-filter-panel')).toHaveClass(
      'hidden',
    )
    const filter = screen.getByRole('button', { name: 'Filter' })
    expect(filter).toHaveAttribute('aria-expanded', 'false')
    expect(filter).not.toHaveTextContent('Filter')
    expect(filter.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByDisplayValue('history')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))

    expect(screen.getByLabelText('Reading state')).toHaveValue('READING')
    expect(screen.getByLabelText('Format')).toHaveValue('PHYSICAL')
    expect(screen.getByLabelText('Ownership')).toHaveValue('HAVE')
    expect(screen.getByLabelText('Location')).toHaveValue('shelf-1')
    expect(screen.getByLabelText('Genre')).toHaveValue('genre-1')
    expect(document.querySelector('#library-filter-panel')).toHaveClass('grid')
    expect(document.querySelector('#library-filter-panel')).not.toHaveClass(
      'hidden',
    )
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    const hideFilters = screen.getByRole('button', { name: 'Hide filters' })
    expect(hideFilters).not.toHaveTextContent('Hide filters')
    expect(hideFilters.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    fireEvent.click(hideFilters)

    expect(screen.getByLabelText('Reading state')).not.toBeVisible()
  })

  it('resets disclosure state when remounted', () => {
    const view = renderControls('EN')
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByLabelText('Reading state')).toBeInTheDocument()

    view.unmount()
    renderControls('EN')

    expect(screen.getByLabelText('Reading state')).not.toBeVisible()
  })

  it('keeps active filters in the form while the panel is hidden', () => {
    const { container } = renderControls()
    const form = container.querySelector('form')

    expect(new FormData(form!).get('reading')).toBe('READING')
    expect(new FormData(form!).get('genre')).toBe('genre-1')
  })

  it('uses Korean by default without changing option values', () => {
    renderControls()

    expect(screen.getByRole('button', { name: '필터' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '필터' }))
    expect(screen.getByLabelText('독서 상태')).toHaveValue('READING')
    expect(screen.getByRole('option', { name: '읽는 중' })).toHaveValue(
      'READING',
    )
  })
})
