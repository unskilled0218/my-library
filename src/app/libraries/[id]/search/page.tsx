import Link from 'next/link'
import { addKyoboBookAction, addManualBookAction } from '@/app/actions'
import { IsbnScanner } from '@/components/isbn-scanner'
import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { getKyoboBook, searchKyobo } from '@/lib/kyobo'

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; selected?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  await requireLibraryAccess(user, id, 'WRITE')
  const { q = '', selected } = await searchParams
  const results = q ? await searchKyobo(q).catch(() => []) : []
  const detail = selected
    ? await getKyoboBook(selected).catch(() => null)
    : null
  return (
    <div
      id={`kyobo-search-page-${id}`}
      className="mx-auto max-w-6xl px-5 py-12 md:px-8"
    >
      <p className="eyebrow">Add a book</p>
      <h1 className="mt-2 font-serif text-5xl font-black">Search Kyobo</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <form className="panel flex gap-3">
            <input
              name="q"
              defaultValue={q}
              placeholder="Title, author, or ISBN"
              autoFocus
              required
            />
            <button>Search</button>
          </form>
          <div className="mt-5 space-y-3">
            {results.map((result, index) => (
              <Link
                key={`${result.saleId}-${index}`}
                className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4 transition hover:border-moss"
                href={`?q=${encodeURIComponent(q)}&selected=${result.saleId}`}
              >
                {result.coverUrl && (
                  <img
                    className="h-24 w-16 object-contain"
                    src={result.coverUrl}
                    alt=""
                  />
                )}
                <div>
                  <p className="font-serif text-xl font-bold">{result.title}</p>
                  <p className="mt-1 text-sm text-ink/60">
                    {result.isbn} · {result.format}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {detail && (
            <article className="panel mt-6">
              <div className="flex gap-5">
                {detail.coverUrl && (
                  <img
                    className="h-44 w-28 object-contain"
                    src={detail.coverUrl}
                    alt=""
                  />
                )}
                <div>
                  <p className="eyebrow">Review before adding</p>
                  <h2 className="mt-2 font-serif text-3xl font-bold">
                    {detail.title}
                  </h2>
                  <p className="mt-2 text-sm">{detail.authors.join(', ')}</p>
                  <p className="mt-3 text-sm leading-6 text-ink/60">
                    {detail.description}
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-xs text-ink/60">
                {detail.genrePaths.map((path, index) => (
                  <p key={index}>
                    {path.map((genre) => genre.name).join(' > ')}
                  </p>
                ))}
              </div>
              <form action={addKyoboBookAction} className="mt-5">
                <input type="hidden" name="libraryId" value={id} />
                <input type="hidden" name="saleId" value={detail.saleId} />
                <button>Add to library</button>
              </form>
            </article>
          )}
        </section>
        <aside className="space-y-5">
          <IsbnScanner />
          <details className="panel">
            <summary className="cursor-pointer font-serif text-2xl font-bold">
              Manual fallback
            </summary>
            <p className="mt-3 text-sm text-ink/60">
              A canonical Kyobo product URL and complete genre path are
              required.
            </p>
            <form action={addManualBookAction} className="mt-5 space-y-3">
              <input type="hidden" name="libraryId" value={id} />
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
              <select name="format">
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
        </aside>
      </div>
    </div>
  )
}
