// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryBookList } from '@/components/library-book-list'
import type { BookDisplay, CardBook } from '@/components/book-card'
import { LocaleProvider } from '@/components/locale-provider'

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
  const renderList = (
    initialView: 'GRID' | 'LIST',
    language: 'KO' | 'EN' = 'KO',
    listBooks = books,
  ) =>
    render(
      <LocaleProvider language={language}>
        <LibraryBookList
          books={listBooks}
          display={display}
          initialView={initialView}
        />
      </LocaleProvider>,
    )

  it('switches layout locally without changing the URL or scrolling', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const initialUrl = window.location.href
    renderList('GRID', 'EN')

    const grid = screen.getByRole('button', { name: 'Grid' })
    const list = screen.getByRole('button', { name: 'List' })
    expect(grid).toHaveAttribute('aria-pressed', 'true')
    expect(grid).not.toHaveTextContent('Grid')
    expect(list).not.toHaveTextContent('List')
    expect(grid.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(list.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('#library-book-list')).toHaveAttribute(
      'data-view',
      'GRID',
    )

    fireEvent.click(list)

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
    renderList('LIST', 'EN')

    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('localizes book metadata and the empty state in Korean', () => {
    const view = renderList('GRID')

    expect(screen.getByText('읽는 중')).toBeInTheDocument()
    expect(screen.getByText('종이책')).toBeInTheDocument()
    expect(screen.getByText('표지 없음')).toBeInTheDocument()

    view.unmount()
    renderList('GRID', 'KO', [])
    expect(screen.getByText('책을 찾지 못했습니다')).toBeInTheDocument()
  })
})
