import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  addLocationAction,
  deleteLibraryAction,
  deleteLocationAction,
  removeMemberAction,
  renameLocationAction,
  shareLibraryAction,
  updateDisplayAction,
  updateLibraryAction,
} from '@/app/actions'
import { LibraryBookList } from '@/components/library-book-list'
import { LibrarySearchControls } from '@/components/library-search-controls'
import { libraryAccess, requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

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
  const canWrite = access === 'OWNER' || access === 'EDITOR'
  const genreOptions = await db.genre.findMany({ orderBy: { name: 'asc' } })
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
      settings: true,
      locationTags: { orderBy: { name: 'asc' } },
      members: {
        include: { user: { select: { id: true, loginId: true } } },
        orderBy: { createdAt: 'asc' },
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
  const initialView = library.settings?.defaultView ?? 'GRID'
  const display = library.settings ?? {
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
          <p className="eyebrow">{access} access</p>
          <h1 className="mt-2 font-serif text-5xl font-black">
            {library.name}
          </h1>
          <p className="mt-3 max-w-2xl text-ink/60">{library.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Link className="button" href={`/libraries/${id}/search`}>
              Add from Kyobo
            </Link>
          )}
          <Link
            className="button button-secondary"
            href={`/libraries/${id}/stats`}
          >
            Statistics
          </Link>
          {access === 'OWNER' && (
            <>
              <Link
                className="button button-secondary"
                href={`/libraries/${id}/audit`}
              >
                Audit log
              </Link>
              <Link
                className="button button-secondary"
                href={`/libraries/${id}/transfer`}
              >
                Import / export
              </Link>
            </>
          )}
        </div>
      </div>
      <LibrarySearchControls
        query={activeFilters}
        locations={library.locationTags}
        genres={genreOptions}
      />
      <LibraryBookList
        books={library.books}
        display={display}
        initialView={initialView}
      />
      {(page > 1 || library.books.length === 100) && (
        <nav className="mt-8 flex justify-center gap-3" aria-label="Book pages">
          {page > 1 && (
            <Link
              className="button button-secondary"
              href={`?${new URLSearchParams({ ...activeFilters, page: String(page - 1) })}`}
            >
              Previous
            </Link>
          )}
          {library.books.length === 100 && (
            <Link
              className="button button-secondary"
              href={`?${new URLSearchParams({ ...activeFilters, page: String(page + 1) })}`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
      {canWrite && (
        <section
          id="library-editor-settings"
          className="mt-14 grid gap-6 lg:grid-cols-2"
        >
          <div id="library-location-settings" className="panel">
            <p className="eyebrow">Locations</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">Shelf tags</h2>
            <form action={addLocationAction} className="mt-5 flex gap-2">
              <input type="hidden" name="libraryId" value={id} />
              <input name="name" required placeholder="Bob's room" />
              <button>Add</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {library.locationTags.map((tag) => (
                <div key={tag.id} className="flex gap-1">
                  <form action={renameLocationAction} className="flex gap-1">
                    <input type="hidden" name="libraryId" value={id} />
                    <input type="hidden" name="tagId" value={tag.id} />
                    <input
                      className="w-36"
                      name="name"
                      defaultValue={tag.name}
                      aria-label={`Rename ${tag.name}`}
                    />
                    <button className="button-secondary" type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteLocationAction}>
                    <input type="hidden" name="libraryId" value={id} />
                    <input type="hidden" name="tagId" value={tag.id} />
                    <button
                      className="button-secondary"
                      type="submit"
                      aria-label={`Delete ${tag.name}`}
                    >
                      ×
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
          <div id="library-display-settings" className="panel">
            <p className="eyebrow">Display</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">Library view</h2>
            <form action={updateDisplayAction} className="mt-5 space-y-3">
              <input type="hidden" name="libraryId" value={id} />
              <select
                name="defaultView"
                defaultValue={library.settings?.defaultView}
              >
                <option value="GRID">Grid</option>
                <option value="LIST">List</option>
              </select>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['showCover', 'Cover'],
                  ['showTitle', 'Title'],
                  ['showAuthors', 'Authors'],
                  ['showGenre', 'Genre'],
                  ['showReading', 'Reading'],
                  ['showLocation', 'Location'],
                ].map(([name, label]) => (
                  <label key={name} className="flex items-center gap-2">
                    <input
                      className="h-4 w-4"
                      type="checkbox"
                      name={name}
                      defaultChecked={
                        library.settings?.[
                          name as keyof typeof library.settings
                        ] as boolean
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button>Save display</button>
            </form>
          </div>
        </section>
      )}
      {access === 'OWNER' && (
        <section
          id="library-owner-settings"
          className="mt-6 grid gap-6 lg:grid-cols-2"
        >
          <div id="library-sharing-settings" className="panel">
            <p className="eyebrow">Sharing</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">Members</h2>
            <form
              action={shareLibraryAction}
              className="mt-5 grid gap-2 sm:grid-cols-[1fr_120px_auto]"
            >
              <input type="hidden" name="libraryId" value={id} />
              <input name="loginId" required placeholder="Login ID" />
              <select name="role">
                <option value="VIEWER">Viewer</option>
                <option value="EDITOR">Editor</option>
              </select>
              <button>Add</button>
            </form>
            <div className="mt-4 space-y-2">
              {library.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl bg-ink/5 p-3 text-sm"
                >
                  <span>
                    {member.user.loginId} · {member.role}
                  </span>
                  <form action={removeMemberAction}>
                    <input type="hidden" name="libraryId" value={id} />
                    <input
                      type="hidden"
                      name="memberId"
                      value={member.user.id}
                    />
                    <button className="button-secondary">Remove</button>
                  </form>
                </div>
              ))}
            </div>
          </div>
          <div id="library-details-settings" className="panel">
            <p className="eyebrow">Ownership</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">
              Library settings
            </h2>
            <form action={updateLibraryAction} className="mt-5 space-y-3">
              <input type="hidden" name="libraryId" value={id} />
              <input name="name" defaultValue={library.name} required />
              <textarea
                name="description"
                defaultValue={library.description}
                rows={3}
              />
              <button>Save library</button>
            </form>
            <form
              action={deleteLibraryAction}
              className="mt-6 border-t border-rust/20 pt-5"
            >
              <input type="hidden" name="libraryId" value={id} />
              <button className="bg-rust" type="submit">
                Delete library
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  )
}
