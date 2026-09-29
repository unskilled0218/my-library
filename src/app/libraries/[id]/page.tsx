import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LibraryBookList } from '@/components/library-book-list'
import { LibrarySearchControls } from '@/components/library-search-controls'
import { SettingsIcon } from '@/components/icons'
import { libraryAccess, requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { commonMessages, enumMessages } from '@/lib/i18n/common'
import { librariesMessages } from '@/lib/i18n/libraries'
import { getLanguage } from '@/lib/i18n/server'

export default async function LibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    q?: string
    reading?: string
    format?: string
    ownership?: string
    location?: string
    genre?: string
    page?: string
  }>
}) {
  const user = await requireUser()
  const { id } = await params
  const access = await libraryAccess(user.id, id)
  if (!access) notFound()
  await requireLibraryAccess(user, id, 'READ')
  const query = await searchParams
  const page = Math.max(1, Number(query.page) || 1)
  const activeFilters = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.reading ? { reading: query.reading } : {}),
    ...(query.format ? { format: query.format } : {}),
    ...(query.ownership ? { ownership: query.ownership } : {}),
    ...(query.location ? { location: query.location } : {}),
    ...(query.genre ? { genre: query.genre } : {}),
  }
  const [genreOptions, viewerSettings, language] = await Promise.all([
    db.genre.findMany({ orderBy: { name: 'asc' } }),
    db.userDisplaySettings.findUnique({ where: { userId: user.id } }),
    getLanguage(),
  ])
  const messages = librariesMessages[language]
  const common = commonMessages[language]
  const genreFilterIds = query.genre ? [query.genre] : []
  for (let index = 0; index < genreFilterIds.length; index += 1)
    genreFilterIds.push(
      ...genreOptions
        .filter((genre) => genre.parentId === genreFilterIds[index])
        .map((genre) => genre.id),
    )
  const library = await db.library.findUnique({
    where: { id },
    include: {
      owner: {
        select: { locationTags: { orderBy: { name: 'asc' } } },
      },
      books: {
        where: {
          ...(query.q
            ? {
                OR: [
                  { title: { contains: query.q, mode: 'insensitive' } },
                  { description: { contains: query.q, mode: 'insensitive' } },
                  { comment: { contains: query.q, mode: 'insensitive' } },
                  { authors: { has: query.q } },
                  { isbn13: { contains: query.q } },
                  {
                    genres: {
                      some: {
                        genre: {
                          name: { contains: query.q, mode: 'insensitive' },
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
          ...(query.reading &&
          ['NOT_STARTED', 'READING', 'DONE'].includes(query.reading)
            ? {
                readingState: query.reading as
                  'NOT_STARTED' | 'READING' | 'DONE',
              }
            : {}),
          ...(query.format && ['PHYSICAL', 'EBOOK'].includes(query.format)
            ? { format: query.format as 'PHYSICAL' | 'EBOOK' }
            : {}),
          ...(query.ownership && ['HAVE', 'DONT_HAVE'].includes(query.ownership)
            ? { ownershipState: query.ownership as 'HAVE' | 'DONT_HAVE' }
            : {}),
          ...(query.location ? { locationTagId: query.location } : {}),
          ...(query.genre
            ? { genres: { some: { genreId: { in: genreFilterIds } } } }
            : {}),
        },
        include: { locationTag: true, genres: { include: { genre: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        skip: (page - 1) * 100,
      },
    },
  })
  if (!library) notFound()
  const initialView = viewerSettings?.defaultView ?? 'GRID'
  const display = viewerSettings ?? {
    showCover: true,
    showTitle: true,
    showAuthors: true,
    showGenre: true,
    showReading: true,
    showLocation: false,
  }
  return (
    <div
      id={`library-page-${id}`}
      className="mx-auto max-w-7xl px-5 py-10 md:px-8"
    >
      <div
        id="library-header"
        className="flex flex-wrap items-start justify-between gap-5"
      >
        <div>
          <p className="eyebrow">
            {common[enumMessages[access]]} {messages.access}
          </p>
          <h1 className="mt-2 font-serif text-5xl font-black">
            {library.name}
          </h1>
          <p className="mt-3 max-w-2xl text-ink/60">{library.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            id="library-settings-link"
            className="button button-secondary h-12 w-12 p-0"
            href={`/libraries/${id}/settings`}
            aria-label={common.settings}
          >
            <SettingsIcon />
          </Link>
        </div>
      </div>
      <LibrarySearchControls
        query={activeFilters}
        locations={library.owner.locationTags}
        genres={genreOptions}
      />
      <LibraryBookList
        books={library.books}
        display={display}
        initialView={initialView}
      />
      {(page > 1 || library.books.length === 100) && (
        <nav
          className="mt-8 flex justify-center gap-3"
          aria-label={messages.bookPages}
        >
          {page > 1 && (
            <Link
              className="button button-secondary"
              href={`?${new URLSearchParams({ ...activeFilters, page: String(page - 1) })}`}
            >
              {messages.previous}
            </Link>
          )}
          {library.books.length === 100 && (
            <Link
              className="button button-secondary"
              href={`?${new URLSearchParams({ ...activeFilters, page: String(page + 1) })}`}
            >
              {messages.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}
