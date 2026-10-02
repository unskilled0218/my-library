import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { addKyoboBookAction } from '@/app/actions'
import { currentUser } from '@/lib/auth'
import {
  normalizeSearchQuery,
  normalizeSearchSource,
} from '@/lib/global-search'
import { commonMessages, enumMessages } from '@/lib/i18n/common'
import { searchMessages } from '@/lib/i18n/search'
import { getLanguage } from '@/lib/i18n/server'
import { getKyoboBook, type KyoboBook } from '@/lib/kyobo'
import {
  appendSearchContext,
  buildSearchHref,
  isKyoboSaleId,
  kyoboPreviewEntries,
  kyoboProductUrl,
  parseKyoboPreview,
  type KyoboPreview,
  type KyoboSearchContext,
} from '@/lib/kyobo-preview'
import { writableLibraryDestinations } from '@/lib/library-search'

type DetailSearchParams = Record<string, string | string[] | undefined>
type Destination = { id: string; name: string }
type Messages = { [Key in keyof (typeof searchMessages)['KO']]: string }
type CommonMessages = { [Key in keyof (typeof commonMessages)['KO']]: string }
type DetailResult =
  { book: KyoboBook; error: false } | { book: null; error: true }

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function detailHref(
  saleId: string,
  context: KyoboSearchContext,
  preview: KyoboPreview | null,
  retry = false,
) {
  const params = appendSearchContext(new URLSearchParams(), context)
  if (preview) {
    kyoboPreviewEntries(preview).forEach(([key, value]) =>
      params.append(key, value),
    )
  }
  if (retry) params.set('retry', Date.now().toString())
  return `/search/kyobo/${saleId}?${params}`
}

export function KyoboDetailsLoading({ messages }: { messages: Messages }) {
  return (
    <section
      id="kyobo-details-loading"
      className="panel min-h-64"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-moss">{messages.loadingDetails}</p>
      <div className="mt-5 space-y-3" aria-hidden="true">
        <div className="h-5 w-2/3 animate-pulse rounded bg-moss/10" />
        <div className="h-4 w-full animate-pulse rounded bg-moss/10" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-moss/10" />
        <div className="h-20 w-full animate-pulse rounded bg-moss/10" />
      </div>
    </section>
  )
}

export async function KyoboDetails({
  result,
  saleId,
  context,
  preview,
  destinations,
  signedIn,
  selectedDestinationId,
  duplicate,
  messages,
  common,
}: {
  result: Promise<DetailResult>
  saleId: string
  context: KyoboSearchContext
  preview: KyoboPreview | null
  destinations: Destination[]
  signedIn: boolean
  selectedDestinationId?: string
  duplicate: boolean
  messages: Messages
  common: CommonMessages
}) {
  const detail = await result

  if (detail.error) {
    return (
      <section className="panel" id="kyobo-details-error">
        <p className="text-sm text-rust" role="alert">
          {messages.detailsUnavailable}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="button"
            href={detailHref(saleId, context, preview, true)}
          >
            {messages.retryDetails}
          </Link>
          <Link
            className="button button-secondary"
            href={buildSearchHref(context)}
          >
            {messages.backToResults}
          </Link>
        </div>
      </section>
    )
  }

  const { book } = detail
  const metadataChanged = Boolean(
    preview &&
    (preview.title !== book.title ||
      preview.isbn !== book.isbn ||
      preview.format !== book.format),
  )

  return (
    <section id="kyobo-loaded-details" className="panel">
      <p className="eyebrow">{messages.loadedDetails}</p>
      {duplicate && (
        <p
          id="kyobo-add-message"
          className="mt-4 rounded-xl bg-rust/10 p-4 text-sm font-semibold text-rust"
          role="alert"
        >
          {messages.alreadyExists}
        </p>
      )}
      <h2 className="mt-4 break-words font-serif text-3xl font-bold">
        {book.title}
      </h2>
      <p className="mt-2 text-sm text-ink/60">
        {messages.isbnLabel}: {book.isbn} · {messages.formatLabel}:{' '}
        {common[enumMessages[book.format]]}
      </p>
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.5fr)]">
        <div className="min-w-0 space-y-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">
              {messages.contributors}
            </h2>
            <p className="mt-2">{book.authors.join(', ')}</p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">
              {messages.description}
            </h2>
            <p className="mt-2 whitespace-pre-wrap leading-7 text-ink/70">
              {book.description}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">
              {messages.genres}
            </h2>
            <div className="mt-2 space-y-2 text-sm text-ink/70">
              {book.genrePaths.map((path) => (
                <p key={path.map((genre) => genre.url).join('|')}>
                  {path.map((genre) => genre.name).join(' > ')}
                </p>
              ))}
            </div>
          </div>
          {metadataChanged && (
            <div className="rounded-xl bg-moss/5 p-4 text-sm">
              <p className="font-semibold">{messages.correctedMetadata}</p>
              <p className="mt-1 text-ink/60">
                {messages.isbnLabel}: {book.isbn} · {messages.formatLabel}:{' '}
                {common[enumMessages[book.format]]}
              </p>
            </div>
          )}
        </div>
        <div>
          {signedIn ? (
            destinations.length ? (
              <form action={addKyoboBookAction} className="space-y-4">
                <input type="hidden" name="saleId" value={book.saleId} />
                <input type="hidden" name="q" value={context.q} />
                <input type="hidden" name="source" value={context.source} />
                {preview?.title &&
                  kyoboPreviewEntries(preview).map(([key, value], index) => (
                    <input
                      key={`${key}-${index}`}
                      type="hidden"
                      name={key}
                      value={value}
                    />
                  ))}
                <label className="block text-sm font-semibold">
                  {messages.destinationLibrary}
                  <select
                    id="kyobo-destination-library"
                    className="mt-1"
                    name="libraryId"
                    defaultValue={selectedDestinationId}
                    required
                  >
                    {destinations.map((library) => (
                      <option key={library.id} value={library.id}>
                        {library.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="w-full" type="submit">
                  {messages.addToLibrary}
                </button>
              </form>
            ) : (
              <p className="text-sm text-rust">{messages.noWritableLibrary}</p>
            )
          ) : (
            <Link className="button" href="/login">
              {messages.signInToAdd}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export default async function KyoboDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>
  searchParams: Promise<DetailSearchParams>
}) {
  const { saleId } = await params
  if (!isKyoboSaleId(saleId)) notFound()

  const resultPromise: Promise<DetailResult> = getKyoboBook(saleId)
    .then((book) => ({ book, error: false as const }))
    .catch(() => ({ book: null, error: true as const }))
  const [rawQuery, language, user] = await Promise.all([
    searchParams,
    getLanguage(),
    currentUser(),
  ])
  const messages = searchMessages[language]
  const common = commonMessages[language]
  const q = normalizeSearchQuery(firstValue(rawQuery.q))
  const source = normalizeSearchSource(
    firstValue(rawQuery.source),
    Boolean(user),
  )
  const preview = parseKyoboPreview(rawQuery)
  const destinations = user ? await writableLibraryDestinations(user.id) : []
  const requestedDestination = firstValue(rawQuery.libraryId)
  const selectedDestinationId = destinations.some(
    (library) => library.id === requestedDestination,
  )
    ? requestedDestination
    : destinations[0]?.id
  const context: KyoboSearchContext = {
    q,
    source,
    ...(selectedDestinationId ? { libraryId: selectedDestinationId } : {}),
  }

  return (
    <main
      id="kyobo-detail-page"
      className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12"
    >
      <Link
        className="text-sm font-semibold text-moss"
        href={buildSearchHref(context)}
      >
        ← {messages.backToResults}
      </Link>
      <article className="mt-6 rounded-3xl border border-ink/10 bg-white/80 p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row">
          {preview?.coverUrl && (
            <img
              className="h-52 w-36 shrink-0 self-center object-contain sm:self-start"
              src={preview.coverUrl}
              alt=""
            />
          )}
          <div className="min-w-0">
            <p className="eyebrow">{messages.previewDetails}</p>
            <h1 className="mt-2 break-words font-serif text-4xl font-black">
              {preview?.title ?? messages.kyoboDetails}
            </h1>
            {preview ? (
              <>
                {preview.authors.length > 0 && (
                  <p className="mt-3 text-ink/70">
                    {preview.authors.join(', ')}
                  </p>
                )}
                <p className="mt-3 text-sm text-ink/60">
                  {messages.isbnLabel}: {preview.isbn} · {messages.formatLabel}:{' '}
                  {common[enumMessages[preview.format]]}
                </p>
              </>
            ) : (
              <p className="mt-3 text-ink/60">{messages.directLinkPreview}</p>
            )}
            <a
              className="mt-4 inline-block text-sm font-semibold text-rust underline"
              href={kyoboProductUrl(saleId)}
              target="_blank"
              rel="noreferrer"
            >
              {messages.sourceLink}
            </a>
          </div>
        </div>
      </article>
      <div className="mt-6">
        <Suspense fallback={<KyoboDetailsLoading messages={messages} />}>
          <KyoboDetails
            result={resultPromise}
            saleId={saleId}
            context={context}
            preview={preview}
            destinations={destinations}
            signedIn={Boolean(user)}
            selectedDestinationId={selectedDestinationId}
            duplicate={firstValue(rawQuery.status) === 'already-exists'}
            messages={messages}
            common={common}
          />
        </Suspense>
      </div>
    </main>
  )
}
