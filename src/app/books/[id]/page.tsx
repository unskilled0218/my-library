import { notFound } from 'next/navigation'
import { deleteBookAction, updateBookAction } from '@/app/actions'
import { libraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

const dateInput = (date: Date | null) => date?.toISOString().slice(0, 10) ?? ''

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const book = await db.book.findUnique({
    where: { id },
    include: {
      library: true,
      locationTag: true,
      genres: { include: { genre: true } },
    },
  })
  if (!book) notFound()
  const access = await libraryAccess(user.id, book.libraryId)
  if (!access) notFound()
  const canWrite = access === 'OWNER' || access === 'EDITOR'
  const locations = canWrite
    ? await db.locationTag.findMany({
        where: { libraryId: book.libraryId },
        orderBy: { name: 'asc' },
      })
    : []
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
      <div className="grid gap-10 md:grid-cols-[300px_1fr]">
        <div>
          {book.coverKey ? (
            <img
              className="w-full rounded-3xl bg-white p-5 shadow-card"
              src={`/api/covers/${book.coverKey}`}
              alt={`Cover of ${book.title}`}
            />
          ) : (
            <div className="panel aspect-[3/4]">No cover</div>
          )}
          <a
            className="mt-4 block break-all text-sm font-semibold text-moss underline"
            href={book.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            View source on Kyobo
          </a>
        </div>
        <div>
          <p className="eyebrow">{book.library.name}</p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-tight">
            {book.title}
          </h1>
          <p className="mt-3 text-lg text-ink/60">{book.authors.join(', ')}</p>
          <p className="mt-6 leading-7 text-ink/75">{book.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {book.genres.map(({ genre }) => (
              <span
                key={genre.id}
                className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss"
              >
                {genre.name}
              </span>
            ))}
          </div>
          {canWrite && (
            <form
              action={updateBookAction}
              className="panel mt-8 grid gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="bookId" value={id} />
              <label>
                Title
                <input name="title" defaultValue={book.title} required />
              </label>
              <label>
                Authors
                <input
                  name="authors"
                  defaultValue={book.authors.join(', ')}
                  required
                />
              </label>
              <label>
                Ownership
                <select
                  name="ownershipState"
                  defaultValue={book.ownershipState}
                >
                  <option value="HAVE">Have</option>
                  <option value="DONT_HAVE">Do not have</option>
                </select>
              </label>
              <label>
                Format
                <select name="format" defaultValue={book.format}>
                  <option value="PHYSICAL">Physical</option>
                  <option value="EBOOK">Ebook</option>
                </select>
              </label>
              <label>
                Reading state
                <select name="readingState" defaultValue={book.readingState}>
                  <option value="NOT_STARTED">Not started</option>
                  <option value="READING">Reading</option>
                  <option value="DONE">Done</option>
                </select>
              </label>
              <label>
                Location
                <select
                  name="locationTagId"
                  defaultValue={book.locationTagId ?? ''}
                >
                  <option value="">None</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Started
                <input
                  type="date"
                  name="readingStartedAt"
                  defaultValue={dateInput(book.readingStartedAt)}
                />
              </label>
              <label>
                Finished
                <input
                  type="date"
                  name="readingFinishedAt"
                  defaultValue={dateInput(book.readingFinishedAt)}
                />
              </label>
              <label>
                Rating
                <select name="rating" defaultValue={book.rating ?? ''}>
                  <option value="">Not rated</option>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating}>{rating}</option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2">
                Personal comment
                <textarea name="comment" rows={5} defaultValue={book.comment} />
              </label>
              <button className="sm:col-span-2">Save book</button>
            </form>
          )}
        </div>
      </div>
      {canWrite && (
        <form action={deleteBookAction} className="mt-8 text-right">
          <input type="hidden" name="bookId" value={id} />
          <button className="bg-rust">Delete book</button>
        </form>
      )}
    </div>
  )
}
