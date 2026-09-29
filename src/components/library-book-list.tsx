'use client'

import { useState } from 'react'
import { GridIcon, ListIcon } from '@/components/icons'
import {
  BookCard,
  type BookDisplay,
  type CardBook,
} from '@/components/book-card'
import { useLanguage } from '@/components/locale-provider'
import { commonMessages } from '@/lib/i18n/common'
import { librariesMessages } from '@/lib/i18n/libraries'

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
  const language = useLanguage()
  const messages = librariesMessages[language]
  const common = commonMessages[language]

  return (
    <>
      <div id="library-view-controls" className="mt-5 flex justify-end gap-2">
        <button
          id="library-grid-view"
          className={`h-10 w-10 p-0 ${view === 'GRID' ? '' : 'button-secondary'}`}
          type="button"
          aria-label={common.grid}
          aria-pressed={view === 'GRID'}
          onClick={() => setView('GRID')}
        >
          <GridIcon />
        </button>
        <button
          id="library-list-view"
          className={`h-10 w-10 p-0 ${view === 'LIST' ? '' : 'button-secondary'}`}
          type="button"
          aria-label={common.list}
          aria-pressed={view === 'LIST'}
          onClick={() => setView('LIST')}
        >
          <ListIcon />
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
            <p className="font-serif text-2xl font-bold">
              {messages.noBooksFound}
            </p>
            <p className="mt-2 text-ink/60">{messages.emptyBooksBody}</p>
          </div>
        )}
      </div>
    </>
  )
}
