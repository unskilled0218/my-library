'use client'

import { useState } from 'react'
import {
  BookCard,
  type BookDisplay,
  type CardBook,
} from '@/components/book-card'

type LibraryView = 'LIST' | 'GRID'

export function LibraryBookList({
  books,
  display,
  initialView,
}: {
  books: CardBook[]
  display: BookDisplay
  initialView: LibraryView
}) {
  const [view, setView] = useState<LibraryView>(initialView)

  return (
    <>
      <div id="library-view-controls" className="mt-5 flex justify-end gap-2">
        <button
          id="library-grid-view"
          className={view === 'GRID' ? '' : 'button-secondary'}
          type="button"
          aria-pressed={view === 'GRID'}
          onClick={() => setView('GRID')}
        >
          Grid
        </button>
        <button
          id="library-list-view"
          className={view === 'LIST' ? '' : 'button-secondary'}
          type="button"
          aria-pressed={view === 'LIST'}
          onClick={() => setView('LIST')}
        >
          List
        </button>
      </div>
      <div
        id="library-book-list"
        data-view={view}
        className={`mt-6 grid gap-5 ${view === 'GRID' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}
      >
        {books.map((book) => (
          <BookCard key={book.id} book={book} view={view} display={display} />
        ))}
        {books.length === 0 && (
          <div className="panel col-span-full text-center">
            <p className="font-serif text-2xl font-bold">No books found</p>
            <p className="mt-2 text-ink/60">
              Add a book or change the current filters.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
