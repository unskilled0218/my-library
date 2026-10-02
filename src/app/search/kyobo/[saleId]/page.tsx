import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { addKyoboBookAction } from '@/app/actions'
import { KyoboSearchMetadata } from '@/components/kyobo-search-metadata'
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
  appendKyoboPreview,
  appendSearchContext,
  buildSearchHref,
  isAllowedKyoboCoverUrl,
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

export function detailHref(
  saleId: string,
  context: KyoboSearchContext,
  preview: KyoboPreview | null,
  retry = false,
) {
  const params = appendSearchContext(new URLSearchParams(), context)
  if (retry) params.set('retry', Date.now().toString())
  if (preview) appendKyoboPreview(params, preview)
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
  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()
  const titleChanged = Boolean(
    preview && normalizeText(preview.title) !== normalizeText(book.title),
  )
  const isbnChanged = Boolean(preview && preview.isbn !== book.isbn)
  const formatChanged = Boolean(preview && preview.format !== book.format)
  const authorsChanged = Boolean(
    preview &&
    preview.authors.length > 0 &&
    preview.authors.map(normalizeText).join('|') !==
      book.authors.map(normalizeText).join('|'),
  )
  const previewDescription = preview?.description
    ? normalizeText(preview.description)
    : ''
  const canonicalDescription = normalizeText(book.description)
  const descriptionContinues = Boolean(
    preview?.descriptionTruncated &&
    previewDescription &&
    canonicalDescription.startsWith(previewDescription),
  )
  const descriptionChanged = Boolean(
    previewDescription &&
    !descriptionContinues &&
    previewDescription !== canonicalDescription,
  )
  const descriptionToRender = descriptionContinues
    ? canonicalDescription.slice(previewDescription.length).trim()
    : book.description
  const canonicalCover = isAllowedKyoboCoverUrl(book.coverUrl)
    ? book.coverUrl
    : null
  const coverChanged = Boolean(
    preview?.coverUrl && canonicalCover !== preview.coverUrl,
  )
  const metadataChanged =
    titleChanged ||
    isbnChanged ||
    formatChanged ||
    authorsChanged ||
    descriptionChanged ||
    coverChanged
  const genrePaths = book.genrePaths.filter(
    (path) =>
      !(
        path.length === 1 &&
        preview?.category &&
        normalizeText(path[0].name) === normalizeText(preview.category)
      ),
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
      {metadataChanged && (
        <p className="mt-4 text-sm font-semibold text-moss">
          {messages.correctedMetadata}
        </p>
      )}
      {(!preview || titleChanged) && (
        <h2 className="mt-4 break-words font-serif text-3xl font-bold">
          {book.title}
        </h2>
      )}
      {(!preview || isbnChanged) && (
        <p className="mt-2 text-sm text-ink/60">
          {messages.isbnLabel}: {book.isbn}
        </p>
      )}
      {(!preview || formatChanged) && (
        <p className="mt-2 text-sm text-ink/60">
          {messages.formatLabel}: {common[enumMessages[book.format]]}
        </p>
      )}
      {(!preview?.coverUrl || coverChanged) && canonicalCover && (
        <img
          className="mt-5 h-44 w-28 object-contain"
          src={canonicalCover}
          alt=""
        />
      )}
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.5fr)]">
        <div className="min-w-0 space-y-5">
          {(!preview || preview.authors.length === 0 || authorsChanged) && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">
                {messages.contributors}
              </h2>
              <p className="mt-2">{book.authors.join(', ')}</p>
            </div>
          )}
          {(!preview?.description ||
            descriptionChanged ||
            (descriptionContinues && descriptionToRender)) && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">
                {descriptionContinues
                  ? messages.descriptionContinuation
                  : messages.description}
              </h2>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-ink/70">
                {descriptionToRender}
              </p>
            </div>
          )}
          {genrePaths.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink/50">
                {messages.genres}
              </h2>
              <div className="mt-2 space-y-2 text-sm text-ink/70">
                {genrePaths.map((path) => (
                  <p key={path.map((genre) => genre.url).join('|')}>
                    {path.map((genre) => genre.name).join(' > ')}
                  </p>
                ))}
              </div>
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
                <KyoboSearchMetadata value={preview} language={language} />
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
