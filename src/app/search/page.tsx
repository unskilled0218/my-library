import Link from 'next/link'
import { addKyoboBookAction, addManualBookAction } from '@/app/actions'
import { KyoboReviewModal } from '@/components/kyobo-review-modal'
import { currentUser } from '@/lib/auth'
import {
  normalizeSearchQuery,
  normalizeSearchSource,
} from '@/lib/global-search'
import {
  searchReadableLibraryBooks,
  writableLibraryDestinations,
} from '@/lib/library-search'
import { getKyoboBook, searchKyobo } from '@/lib/kyobo'

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
  const [user, rawQuery] = await Promise.all([currentUser(), searchParams])
  const q = normalizeSearchQuery(rawQuery.q)
  const source = normalizeSearchSource(rawQuery.source, Boolean(user))
  const searchLibraries = Boolean(user && q && source !== 'kyobo')
  const searchKyoboBooks = Boolean(q && source !== 'library')

  const [libraryResult, kyoboResult, destinations, detailResult] =
    await Promise.all([
      searchLibraries
        ? searchReadableLibraryBooks(user!.id, q)
        : Promise.resolve({ books: [], truncated: false }),
      searchKyoboBooks
        ? searchKyobo(q)
            .then((books) => ({ books, error: '' }))
            .catch(() => ({ books: [], error: 'Kyobo search is unavailable.' }))
        : Promise.resolve({ books: [], error: '' }),
      user && source !== 'library'
        ? writableLibraryDestinations(user.id)
        : Promise.resolve([]),
      rawQuery.selected && source !== 'library'
        ? getKyoboBook(rawQuery.selected)
            .then((book) => ({ book, error: '' }))
            .catch(() => ({
              book: null,
              error: 'Book details are unavailable.',
            }))
        : Promise.resolve({ book: null, error: '' }),
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
      <p className="eyebrow">Discover</p>
      <h1 className="mt-2 font-serif text-5xl font-black">Search books</h1>
      <p className="mt-3 text-ink/60">
        {user
          ? 'Search your readable libraries, Kyobo, or both.'
          : 'Search Kyobo. Sign in to search your libraries or add a book.'}
      </p>
      {rawQuery.status === 'added' && destination && (
        <aside
          id="book-added-notice"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-xl rounded-2xl border border-moss/20 bg-paper p-4 shadow-card sm:p-5"
          role="status"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-serif text-xl font-bold">Book added</p>
              <p className="mt-1 text-sm text-ink/70">
                Added to <strong>{destination.name}</strong>. Keep searching or
                open the library.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                className="button button-secondary"
                href={`/search?${closeParams}`}
                scroll={false}
              >
                Dismiss
              </Link>
              <Link className="button" href={`/libraries/${destination.id}`}>
                Go to library
              </Link>
            </div>
          </div>
        </aside>
      )}
      {!q && (
        <div className="panel mt-8 text-center text-ink/60">
          Enter a title, author, genre, or ISBN in the header search.
        </div>
      )}
      {q && source !== 'kyobo' && user && (
        <section id="library-search-results" className="mt-9">
          <p className="eyebrow">Your libraries</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            Library results
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
                    No cover
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
                    {book.readingState.replace('_', ' ')} · {book.format}
                  </p>
                </div>
              </Link>
            ))}
            {libraryResult.books.length === 0 && (
              <p className="panel text-ink/60">No library books found.</p>
            )}
          </div>
          {libraryResult.truncated && (
            <p className="mt-3 text-sm text-ink/60">
              Showing the 50 most recently updated matches.
            </p>
          )}
        </section>
      )}
      {q && source !== 'library' && (
        <section id="kyobo-search-results" className="mt-9">
          <p className="eyebrow">Kyobo</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">Kyobo results</h2>
          {kyoboResult.error && (
            <p
              className="mt-5 rounded-xl bg-rust/10 p-4 text-sm text-rust"
              role="alert"
            >
              {kyoboResult.error}
            </p>
          )}
          {rawQuery.selected && (detailResult.book || detailResult.error) && (
            <KyoboReviewModal closeHref={`/search?${closeParams}`}>
              {detailResult.error && (
                <p
                  className="rounded-xl bg-rust/10 p-4 text-sm text-rust"
                  role="alert"
                >
                  {detailResult.error}
                </p>
              )}
              {detailResult.book && (
                <article id="kyobo-book-review">
                  {rawQuery.status === 'already-exists' && (
                    <p
                      id="kyobo-add-message"
                      className="mb-5 rounded-xl bg-rust/10 p-4 text-sm font-semibold text-rust"
                      role="alert"
                    >
                      This book already exists in the selected library.
                    </p>
                  )}
                  <div className="flex flex-col gap-5 sm:flex-row">
                    {detailResult.book.coverUrl && (
                      <img
                        className="h-44 w-28 shrink-0 object-contain"
                        src={detailResult.book.coverUrl}
                        alt=""
                      />
                    )}
                    <div>
                      <p className="eyebrow">Review before adding</p>
                      <h2 className="mt-2 font-serif text-3xl font-bold">
                        {detailResult.book.title}
                      </h2>
                      <p className="mt-2 text-sm">
                        {detailResult.book.authors.join(', ')}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-ink/60">
                        {detailResult.book.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2 text-xs text-ink/60">
                    {detailResult.book.genrePaths.map((path, index) => (
                      <p key={index}>
                        {path.map((genre) => genre.name).join(' > ')}
                      </p>
                    ))}
                  </div>
                  {user ? (
                    destinations.length ? (
                      <form
                        action={addKyoboBookAction}
                        className="mt-5 flex flex-col gap-3 sm:flex-row"
                      >
                        <input
                          type="hidden"
                          name="saleId"
                          value={detailResult.book.saleId}
                        />
                        <input type="hidden" name="q" value={q} />
                        <input type="hidden" name="source" value={source} />
                        <label className="min-w-0 flex-1 text-sm font-semibold">
                          Destination library
                          <select
                            id="kyobo-destination-library"
                            className="mt-1"
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
                        <button className="self-end" type="submit">
                          Add to library
                        </button>
                      </form>
                    ) : (
                      <p className="mt-5 text-sm text-rust">
                        You need an owned or editable library before adding
                        books.
                      </p>
                    )
                  ) : (
                    <Link className="button mt-5" href="/login">
                      Sign in to add this book
                    </Link>
                  )}
                </article>
              )}
            </KyoboReviewModal>
          )}
          {!kyoboResult.error && (
            <div className="mt-5 space-y-3">
              {kyoboResult.books.map((book, index) => {
                const params = new URLSearchParams({
                  q,
                  source,
                  selected: book.saleId,
                  ...(destinationId ? { libraryId: destinationId } : {}),
                })
                return (
                  <Link
                    id={`kyobo-result-${book.saleId}`}
                    key={`${book.saleId}-${index}`}
                    className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white/80 p-4 transition hover:border-moss"
                    href={`/search?${params}`}
                  >
                    {book.coverUrl && (
                      <img
                        className="h-24 w-16 shrink-0 object-contain"
                        src={book.coverUrl}
                        alt=""
                      />
                    )}
                    <div>
                      <h3 className="font-serif text-xl font-bold">
                        {book.title}
                      </h3>
                      {book.authors.length > 0 && (
                        <p className="mt-1 text-sm text-ink/70">
                          {book.authors.join(', ')}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-ink/60">
                        {book.isbn} · {book.format}
                      </p>
                    </div>
                  </Link>
                )
              })}
              {kyoboResult.books.length === 0 && (
                <p className="panel text-ink/60">No Kyobo books found.</p>
              )}
            </div>
          )}
          {user && destinations.length > 0 && (
            <details id="manual-book-fallback" className="panel mt-6">
              <summary className="cursor-pointer font-serif text-2xl font-bold">
                Manual fallback
              </summary>
              <p className="mt-3 text-sm text-ink/60">
                A canonical Kyobo product URL and complete genre path are
                required.
              </p>
              <form action={addManualBookAction} className="mt-5 space-y-3">
                <label className="block text-sm font-semibold">
                  Destination library
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
                <input name="title" placeholder="Title" required />
                <input
                  name="authors"
                  placeholder="Authors, comma separated"
                  required
                />
                <input name="isbn" placeholder="ISBN" required />
                <input
                  name="sourceUrl"
                  type="url"
                  placeholder="Kyobo product URL"
                  required
                />
                <select name="format" aria-label="Book format">
                  <option value="PHYSICAL">Physical</option>
                  <option value="EBOOK">Ebook</option>
                </select>
                <textarea
                  name="description"
                  placeholder="Short introduction"
                  rows={4}
                />
                <textarea
                  name="genrePaths"
                  required
                  rows={5}
                  placeholder={
                    'Name | https://store.kyobobook.co.kr/category/... > Child | https://store.kyobobook.co.kr/category/...'
                  }
                />
                <button>Add manually</button>
              </form>
            </details>
          )}
        </section>
      )}
    </div>
  )
}
