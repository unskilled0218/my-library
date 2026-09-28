// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryBookList } from '@/components/library-book-list'
import type { BookDisplay, CardBook } from '@/components/book-card'

const books: CardBook[] = [
  {
    id: 'book-1',
    title: 'A Book',
    authors: ['An Author'],
    coverKey: null,
    description: 'A description',
    format: 'PHYSICAL',
    ownershipState: 'HAVE',
    readingState: 'READING',
    locationTag: { name: 'Study' },
    genres: [{ genre: { name: 'History' } }],
  },
]

const display: BookDisplay = {
  showCover: true,
  showTitle: true,
  showAuthors: true,
  showGenre: true,
  showReading: true,
  showLocation: true,
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('LibraryBookList', () => {
  it('switches layout locally without changing the URL or scrolling', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const initialUrl = window.location.href
    render(
      <LibraryBookList books={books} display={display} initialView="GRID" />,
    )

    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(document.querySelector('#library-book-list')).toHaveAttribute(
      'data-view',
      'GRID',
    )

    fireEvent.click(screen.getByRole('button', { name: 'List' }))

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(document.querySelector('#library-book-list')).toHaveAttribute(
      'data-view',
      'LIST',
    )
    expect(window.location.href).toBe(initialUrl)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('uses the supplied default view', () => {
    render(
      <LibraryBookList books={books} display={display} initialView="LIST" />,
    )

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
