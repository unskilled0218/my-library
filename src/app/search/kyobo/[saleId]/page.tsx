import Link from 'next/link'
import { notFound } from 'next/navigation'
import { KyoboAddBookForm } from '@/components/kyobo-add-book-form'
import { KyoboSearchMetadata } from '@/components/kyobo-search-metadata'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  normalizeSearchQuery,
  normalizeSearchSource,
} from '@/lib/global-search'
import { commonMessages, enumMessages } from '@/lib/i18n/common'
import { searchMessages } from '@/lib/i18n/search'
import { getLanguage } from '@/lib/i18n/server'
import {
  buildSearchHref,
  isKyoboSaleId,
  kyoboProductUrl,
  parseKyoboPreview,
  type KyoboSearchContext,
} from '@/lib/kyobo-preview'
import { flattenedFolders } from '@/lib/library-folders'
import { writableLibraryDestinations } from '@/lib/library-search'

type DetailSearchParams = Record<string, string | string[] | undefined>
const firstValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export default async function KyoboDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>
  searchParams: Promise<DetailSearchParams>
}) {
  const { saleId } = await params
  if (!isKyoboSaleId(saleId)) notFound()
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
  const writable = user ? await writableLibraryDestinations(user.id) : []
  const choices = writable.length
    ? await db.library.findMany({
        where: { id: { in: writable.map((library) => library.id) } },
        select: {
          id: true,
          owner: {
            select: {
              locationTags: {
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
              },
            },
          },
          folders: { select: { id: true, title: true, parentId: true } },
        },
      })
    : []
  const destinations = writable.map((library) => {
    const choice = choices.find((item) => item.id === library.id)
    return {
      ...library,
      locations: choice?.owner.locationTags ?? [],
      folders: flattenedFolders(choice?.folders ?? []),
    }
  })
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
        {user ? (
          destinations.length ? (
            <KyoboAddBookForm
              key={`${saleId}-${selectedDestinationId}`}
              saleId={saleId}
              title={preview?.title}
              q={q}
              source={source}
              destinations={destinations}
              selectedDestinationId={selectedDestinationId}
              language={language}
              ebook={preview?.format === 'EBOOK'}
              duplicate={firstValue(rawQuery.status) === 'already-exists'}
            />
          ) : (
            <p className="panel text-rust">{messages.noWritableLibrary}</p>
          )
        ) : (
          <Link className="button" href="/login">
            {messages.signInToAdd}
          </Link>
        )}
      </div>
    </main>
  )
}
