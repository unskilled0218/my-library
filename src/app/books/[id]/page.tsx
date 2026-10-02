import { notFound } from 'next/navigation'
import { deleteBookAction, updateBookAction } from '@/app/actions'
import { DeleteIcon, SaveIcon } from '@/components/icons'
import { BookFilesPanel } from '@/components/book-files-panel'
import { libraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { booksMessages } from '@/lib/i18n/books'
import { commonMessages } from '@/lib/i18n/common'
import { getLanguage } from '@/lib/i18n/server'

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
      files: { orderBy: { type: 'asc' } },
    },
  })
  if (!book) notFound()
  const access = await libraryAccess(user.id, book.libraryId)
  if (!access) notFound()
  const canWrite = access === 'OWNER' || access === 'EDITOR'
  const [locations, language] = await Promise.all([
    canWrite
      ? db.locationTag.findMany({
          where: { userId: book.library.ownerId },
          orderBy: { name: 'asc' },
        })
      : [],
    getLanguage(),
  ])
  const messages = booksMessages[language]
  const common = commonMessages[language]
  return (
    <div
      id={`book-page-${id}`}
      className="mx-auto max-w-6xl px-5 py-12 md:px-8"
    >
      <div className="grid gap-10 md:grid-cols-[300px_1fr]">
        <div>
          {book.coverKey ? (
            <img
              className="w-full rounded-3xl bg-white p-5 shadow-card"
              src={`/api/covers/${book.coverKey}`}
              alt={messages.coverAlt.replace('{title}', book.title)}
            />
          ) : (
            <div className="panel aspect-[3/4]">{common.noCover}</div>
          )}
          <a
            className="mt-4 block break-all text-sm font-semibold text-moss underline"
            href={book.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            {messages.viewSource}
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
          <BookFilesPanel
            bookId={book.id}
            files={book.files.map(({ type, originalName, size }) => ({
              type,
              originalName,
              size,
            }))}
            canWrite={canWrite}
          />
          {canWrite && (
            <form
              id={`book-edit-form-${id}`}
              action={updateBookAction}
              className="panel mt-8 grid gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="bookId" value={id} />
              <label>
                {messages.title}
                <input name="title" defaultValue={book.title} required />
              </label>
              <label>
                {messages.authors}
                <input
                  name="authors"
                  defaultValue={book.authors.join(', ')}
                  required
                />
              </label>
              <label>
                {messages.ownership}
                <select
                  name="ownershipState"
                  defaultValue={book.ownershipState}
                >
                  <option value="HAVE">{common.have}</option>
                  <option value="DONT_HAVE">{common.dontHave}</option>
                </select>
              </label>
              <label>
                {messages.format}
                <select name="format" defaultValue={book.format}>
                  <option value="PHYSICAL">{common.physical}</option>
                  <option value="EBOOK">{common.ebook}</option>
                </select>
              </label>
              <label>
                {messages.readingState}
                <select name="readingState" defaultValue={book.readingState}>
                  <option value="NOT_STARTED">{common.notStarted}</option>
                  <option value="READING">{common.reading}</option>
                  <option value="DONE">{common.done}</option>
                </select>
              </label>
              <label>
                {messages.location}
                <select
                  name="locationTagId"
                  defaultValue={book.locationTagId ?? ''}
                >
                  <option value="">{messages.none}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {messages.started}
                <input
                  type="date"
                  name="readingStartedAt"
                  defaultValue={dateInput(book.readingStartedAt)}
                />
              </label>
              <label>
                {messages.finished}
                <input
                  type="date"
                  name="readingFinishedAt"
                  defaultValue={dateInput(book.readingFinishedAt)}
                />
              </label>
              <label>
                {messages.rating}
                <select name="rating" defaultValue={book.rating ?? ''}>
                  <option value="">{messages.notRated}</option>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating}>{rating}</option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2">
                {messages.personalComment}
                <textarea name="comment" rows={5} defaultValue={book.comment} />
              </label>
              <button
                className="h-10 w-10 justify-self-end p-0 sm:col-span-2"
                aria-label={messages.saveBook}
              >
                <SaveIcon />
              </button>
            </form>
          )}
        </div>
      </div>
      {canWrite && (
        <form action={deleteBookAction} className="mt-8 text-right">
          <input type="hidden" name="bookId" value={id} />
          <button
            className="h-10 w-10 bg-rust p-0"
            aria-label={messages.deleteBook}
          >
            <DeleteIcon />
          </button>
        </form>
      )}
    </div>
  )
}
