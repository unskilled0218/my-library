'use client'

import Link from 'next/link'
import type { BookFormat, OwnershipState, ReadingState } from '@prisma/client'
import { useLanguage } from '@/components/locale-provider'
import { commonMessages, enumMessages } from '@/lib/i18n/common'

export type CardBook = {
  id: string
  title: string
  authors: string[]
  coverKey: string | null
  description: string
  format: BookFormat
  ownershipState: OwnershipState
  readingState: ReadingState
  locationTag: { name: string } | null
  genres: { genre: { name: string } }[]
}

export type BookDisplay = {
  showCover: boolean
  showTitle: boolean
  showAuthors: boolean
  showGenre: boolean
  showReading: boolean
  showLocation: boolean
}

export function BookCard({
  book,
  view,
  display,
}: {
  book: CardBook
  view: 'LIST' | 'GRID'
  display: BookDisplay
}) {
  const language = useLanguage()
  const common = commonMessages[language]

  return (
    <Link
      id={`book-card-${book.id}`}
      href={`/books/${book.id}`}
      className={`group overflow-hidden rounded-2xl border border-ink/10 bg-white/80 shadow-sm transition hover:-translate-y-1 hover:shadow-card ${view === 'LIST' ? 'flex min-h-44' : 'block'}`}
    >
      {display.showCover && (
        <div
          className={`${view === 'LIST' ? 'w-28 shrink-0 sm:w-36' : 'aspect-[4/3]'} bg-moss/10`}
        >
          {book.coverKey ? (
            <img
              className="h-full w-full object-contain p-3"
              src={`/api/covers/${book.coverKey}`}
              alt=""
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center font-serif text-lg font-bold text-moss/50">
              {common.noCover}
            </div>
          )}
        </div>
      )}
      <div className="p-5">
        {display.showReading && (
          <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-rust">
            <span>{common[enumMessages[book.readingState]]}</span>
            <span>{common[enumMessages[book.format]]}</span>
          </div>
        )}
        {display.showTitle && (
          <h2 className="mt-3 font-serif text-2xl font-bold leading-tight group-hover:text-moss">
            {book.title}
          </h2>
        )}
        {display.showAuthors && (
          <p className="mt-2 text-sm text-ink/60">{book.authors.join(', ')}</p>
        )}
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/60">
          {book.description}
        </p>
        {(display.showGenre || display.showLocation) && (
          <p className="mt-3 text-xs text-ink/50">
            {display.showGenre
              ? book.genres.map(({ genre }) => genre.name).join(' / ')
              : ''}
            {display.showLocation && book.locationTag
              ? ` · ${book.locationTag.name}`
              : ''}
          </p>
        )}
      </div>
    </Link>
  )
}
