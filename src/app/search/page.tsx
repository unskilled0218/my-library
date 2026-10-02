import Link from 'next/link'
import { redirect } from 'next/navigation'
import { addManualBookAction } from '@/app/actions'
import { currentUser } from '@/lib/auth'
import { KyoboSearchMetadata } from '@/components/kyobo-search-metadata'
import {
  normalizeSearchQuery,
  normalizeSearchSource,
} from '@/lib/global-search'
import {
  searchReadableLibraryBooks,
  writableLibraryDestinations,
} from '@/lib/library-search'
import { searchKyobo } from '@/lib/kyobo'
import {
  appendSearchContext,
  buildKyoboDetailHref,
  isKyoboSaleId,
} from '@/lib/kyobo-preview'
import { commonMessages, enumMessages } from '@/lib/i18n/common'
import { searchMessages } from '@/lib/i18n/search'
import { getLanguage } from '@/lib/i18n/server'

type SearchParams = {
  q?: string
  source?: string
  selected?: string
  libraryId?: string
  status?: string
}

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [user, rawQuery, language] = await Promise.all([
    currentUser(),
    searchParams,
    getLanguage(),
  ])
  const messages = searchMessages[language]
  const common = commonMessages[language]
  const q = normalizeSearchQuery(rawQuery.q)
  const source = normalizeSearchSource(rawQuery.source, Boolean(user))
  const searchLibraries = Boolean(user && q && source !== 'kyobo')
  const searchKyoboBooks = Boolean(q && source !== 'library')
  const destinationsPromise =
    user && source !== 'library'
      ? writableLibraryDestinations(user.id)
      : Promise.resolve([])

  if (isKyoboSaleId(rawQuery.selected) && source !== 'library') {
    const destinations = await destinationsPromise
    const destinationId = destinations.some(
      (library) => library.id === rawQuery.libraryId,
    )
      ? rawQuery.libraryId
      : destinations[0]?.id
    const detailParams = appendSearchContext(new URLSearchParams(), {
      q,
      source,
      ...(destinationId ? { libraryId: destinationId } : {}),
    })
    redirect(`/search/kyobo/${rawQuery.selected}?${detailParams}`)
  }

  const [libraryResult, kyoboResult, destinations] = await Promise.all([
    searchLibraries
      ? searchReadableLibraryBooks(user!.id, q)
      : Promise.resolve({ books: [], truncated: false }),
    searchKyoboBooks
      ? searchKyobo(q)
          .then((books) => ({ books, error: '' }))
          .catch(() => ({ books: [], error: messages.kyoboUnavailable }))
      : Promise.resolve({ books: [], error: '' }),
    destinationsPromise,
  ])
  const destinationId = destinations.some(
    (library) => library.id === rawQuery.libraryId,
  )
    ? rawQuery.libraryId
    : destinations[0]?.id
  const closeParams = new URLSearchParams({
    q,
    source,
    ...(destinationId ? { libraryId: destinationId } : {}),
  })
  const destination = destinations.find(
    (library) => library.id === destinationId,
  )

  return (
    <div
      id="global-search-page"
      className="mx-auto max-w-6xl px-5 py-10 md:px-8"
    >
      <p className="eyebrow">{messages.discover}</p>
      <h1 className="mt-2 font-serif text-5xl font-black">{messages.title}</h1>
      <p className="mt-3 text-ink/60">
        {user ? messages.signedInIntro : messages.signedOutIntro}
      </p>
      {rawQuery.status === 'added' && destination && (
        <aside
          id="book-added-notice"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl rounded-2xl border border-moss/20 bg-paper p-4 shadow-card sm:p-5"
          role="status"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-serif text-xl font-bold">
                {messages.bookAdded}
              </p>
              <p className="mt-1 text-sm text-ink/70">
                {messages.addedTo} <strong>{destination.name}</strong>.{' '}
                {messages.addedNext}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                className="button button-secondary"
                href={`/search?${closeParams}`}
                scroll={false}
              >
                {messages.dismiss}
              </Link>
              <Link className="button" href={`/libraries/${destination.id}`}>
                {messages.goToLibrary}
              </Link>
            </div>
          </div>
        </aside>
      )}
      {!q && (
        <div className="panel mt-8 text-center text-ink/60">
          {messages.emptyQuery}
        </div>
      )}
      {q && source !== 'kyobo' && user && (
        <section id="library-search-results" className="mt-9">
          <p className="eyebrow">{messages.yourLibraries}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {messages.libraryResults}
          </h2>
          <div className="mt-5 space-y-3">
            {libraryResult.books.map((book) => (
              <Link
                id={`global-book-result-${book.id}`}
                key={book.id}
                className="flex gap-4 rounded-2xl border border-ink/10 bg-white/80 p-4 transition hover:border-moss"
                href={`/books/${book.id}`}
              >
                {book.coverKey ? (
                  <img
                    className="h-28 w-20 shrink-0 rounded-lg bg-moss/5 object-contain"
                    src={`/api/covers/${book.coverKey}`}
                    alt=""
                  />
                ) : (
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-moss/10 text-center text-xs text-moss/60">
                    {common.noCover}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-rust">
                    {book.library.name}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl font-bold">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink/60">
                    {book.authors.join(', ')}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink/50">
                    {common[enumMessages[book.readingState]]} ·{' '}
                    {common[enumMessages[book.format]]}
                  </p>
                </div>
              </Link>
            ))}
            {libraryResult.books.length === 0 && (
              <p className="panel text-ink/60">{messages.noLibraryBooks}</p>
            )}
          </div>
          {libraryResult.truncated && (
            <p className="mt-3 text-sm text-ink/60">
              {messages.truncatedLibraryResults}
            </p>
          )}
        </section>
      )}
      {q && source !== 'library' && (
        <section id="kyobo-search-results" className="mt-9">
          <p className="eyebrow">{messages.kyoboSource}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {messages.kyoboResults}
          </h2>
          {kyoboResult.error && (
            <p
              className="mt-5 rounded-xl bg-rust/10 p-4 text-sm text-rust"
              role="alert"
            >
              {kyoboResult.error}
            </p>
          )}
          {!kyoboResult.error && (
            <div className="mt-5 space-y-3">
              {kyoboResult.books.map((book, index) => {
                return (
                  <Link
                    id={`kyobo-result-${book.saleId}`}
                    key={`${book.saleId}-${index}`}
                    className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white/80 p-4 transition hover:border-moss"
                    href={buildKyoboDetailHref(book, {
                      q,
                      source,
                      ...(destinationId ? { libraryId: destinationId } : {}),
                    })}
                  >
                    {book.coverUrl && (
                      <img
                        className="h-24 w-16 shrink-0 object-contain"
                        src={book.coverUrl}
                        alt=""
                      />
                    )}
                    <div className="min-w-0">
                      <h3 className="break-words font-serif text-xl font-bold">
                        {book.title}
                      </h3>
                      {book.authors.length > 0 && (
                        <p className="mt-1 text-sm text-ink/70">
                          {book.authors.join(', ')}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-ink/60">
                        {book.isbn} · {common[enumMessages[book.format]]}
                      </p>
                      <KyoboSearchMetadata value={book} language={language} />
                    </div>
                  </Link>
                )
              })}
              {kyoboResult.books.length === 0 && (
                <p className="panel text-ink/60">{messages.noKyoboBooks}</p>
              )}
            </div>
          )}
          {user && destinations.length > 0 && (
            <details id="manual-book-fallback" className="panel mt-6">
              <summary className="cursor-pointer font-serif text-2xl font-bold">
                {messages.manualFallback}
              </summary>
              <p className="mt-3 text-sm text-ink/60">
                {messages.manualRequirement}
              </p>
              <form action={addManualBookAction} className="mt-5 space-y-3">
                <label className="block text-sm font-semibold">
                  {messages.destinationLibrary}
                  <select
                    name="libraryId"
                    defaultValue={destinationId}
                    required
                  >
                    {destinations.map((library) => (
                      <option key={library.id} value={library.id}>
                        {library.name}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  name="title"
                  placeholder={messages.titlePlaceholder}
                  required
                />
                <input
                  name="authors"
                  placeholder={messages.authorsPlaceholder}
                  required
                />
                <input
                  name="isbn"
                  placeholder={messages.isbnPlaceholder}
                  required
                />
                <input
                  name="sourceUrl"
                  type="url"
                  placeholder={messages.kyoboUrlPlaceholder}
                  required
                />
                <select name="format" aria-label={messages.bookFormat}>
                  <option value="PHYSICAL">{common.physical}</option>
                  <option value="EBOOK">{common.ebook}</option>
                </select>
                <textarea
                  name="description"
                  placeholder={messages.introductionPlaceholder}
                  rows={4}
                />
                <textarea
                  name="genrePaths"
                  required
                  rows={5}
                  placeholder={messages.genrePathsPlaceholder}
                />
                <button>{messages.addManually}</button>
              </form>
            </details>
          )}
        </section>
      )}
    </div>
  )
}
