// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LibrarySearchControls } from '@/components/library-search-controls'

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
  it('reveals populated filters and allows them to be hidden', () => {
    render(<LibrarySearchControls {...props} />)

    expect(screen.getByLabelText('Reading state')).not.toBeVisible()
    expect(document.querySelector('#library-filter-panel')).toHaveClass(
      'hidden',
    )
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
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

    fireEvent.click(screen.getByRole('button', { name: 'Hide filters' }))

    expect(screen.getByLabelText('Reading state')).not.toBeVisible()
  })

  it('resets disclosure state when remounted', () => {
    const view = render(<LibrarySearchControls {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByLabelText('Reading state')).toBeInTheDocument()

    view.unmount()
    render(<LibrarySearchControls {...props} />)

    expect(screen.getByLabelText('Reading state')).not.toBeVisible()
  })

  it('keeps active filters in the form while the panel is hidden', () => {
    const { container } = render(<LibrarySearchControls {...props} />)
    const form = container.querySelector('form')

    expect(new FormData(form!).get('reading')).toBe('READING')
    expect(new FormData(form!).get('genre')).toBe('genre-1')
  })
})
