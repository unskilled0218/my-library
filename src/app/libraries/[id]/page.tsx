import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  createFolderAction,
  deleteFolderAction,
  updateFolderAction,
} from '@/app/actions'
import { LibraryBookList } from '@/components/library-book-list'
import { LibrarySearchControls } from '@/components/library-search-controls'
import { DeleteIcon, SaveIcon, SettingsIcon } from '@/components/icons'
import { libraryAccess, requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { commonMessages, enumMessages } from '@/lib/i18n/common'
import { librariesMessages } from '@/lib/i18n/libraries'
import { getLanguage } from '@/lib/i18n/server'
import {
  flattenedFolders,
  folderBreadcrumbs,
  folderDescendantIds,
} from '@/lib/library-folders'

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
    folder?: string
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
  const canWrite = access === 'OWNER' || access === 'EDITOR'
  const activeFilters = {
    ...(query.folder ? { folder: query.folder } : {}),
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
      folders: {
        include: {
          coverBook: { select: { coverKey: true, title: true } },
          _count: { select: { books: true, children: true } },
        },
        orderBy: { title: 'asc' },
      },
      books: {
        where: {
          folderId: query.folder ?? null,
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
  const folderNodes = library.folders.map(({ id, title, parentId }) => ({
    id,
    title,
    parentId,
  }))
  const activeFolder = query.folder
    ? library.folders.find((folder) => folder.id === query.folder)
    : null
  if (query.folder && !activeFolder) notFound()
  const breadcrumbs = activeFolder
    ? folderBreadcrumbs(folderNodes, activeFolder.id)
    : []
  const childFolders = library.folders.filter(
    (folder) => folder.parentId === (activeFolder?.id ?? null),
  )
  const flatFolders = flattenedFolders(folderNodes)
  const unavailableParentIds = activeFolder
    ? new Set([
        activeFolder.id,
        ...folderDescendantIds(folderNodes, activeFolder.id),
      ])
    : new Set<string>()
  const coverBooks = canWrite
    ? await db.book.findMany({
        where: { libraryId: id, coverKey: { not: null } },
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      })
    : []
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
        <Link
          id="library-settings-link"
          className="button button-secondary h-12 w-12 p-0"
          href={`/libraries/${id}/settings`}
          aria-label={common.settings}
        >
          <SettingsIcon />
        </Link>
      </div>

      <nav
        className="mt-8 flex flex-wrap items-center gap-2 text-sm"
        aria-label={messages.folderBreadcrumbs}
      >
        <Link
          className="font-semibold text-moss underline"
          href={`/libraries/${id}`}
        >
          {messages.libraryRoot}
        </Link>
        {breadcrumbs.map((folder) => (
          <span className="flex items-center gap-2" key={folder.id}>
            <span aria-hidden="true">/</span>
            <Link
              className="font-semibold text-moss underline"
              href={`/libraries/${id}?folder=${folder.id}`}
              aria-current={folder.id === activeFolder?.id ? 'page' : undefined}
            >
              {folder.title}
            </Link>
          </span>
        ))}
      </nav>

      {canWrite && (
        <details className="panel mt-5">
          <summary className="cursor-pointer font-serif text-xl font-bold">
            {messages.createFolder}
          </summary>
          <form
            id="folder-create-form"
            action={createFolderAction}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="libraryId" value={id} />
            <input
              type="hidden"
              name="parentId"
              value={activeFolder?.id ?? ''}
            />
            <label>
              {messages.folderTitle}
              <input name="title" maxLength={100} required />
            </label>
            <label>
              {messages.folderCover}
              <select name="coverMode" defaultValue="none">
                <option value="none">{messages.noFolderCover}</option>
                <option value="book">{messages.bookFolderCover}</option>
                <option value="upload">{messages.uploadFolderCover}</option>
              </select>
            </label>
            <label>
              {messages.coverBook}
              <select name="coverBookId" defaultValue="">
                <option value="">{messages.selectCoverBook}</option>
                {coverBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {messages.customCover}
              <input
                type="file"
                name="customCover"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <p className="text-sm text-ink/60 sm:col-span-2">
              {messages.folderCoverLimit}
            </p>
            <button className="sm:col-span-2 sm:justify-self-start">
              {messages.createFolder}
            </button>
          </form>
        </details>
      )}

      {activeFolder && canWrite && (
        <details className="panel mt-5">
          <summary className="cursor-pointer font-serif text-xl font-bold">
            {messages.manageFolder}
          </summary>
          <form
            id="folder-update-form"
            action={updateFolderAction}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="folderId" value={activeFolder.id} />
            <label>
              {messages.folderTitle}
              <input
                name="title"
                defaultValue={activeFolder.title}
                maxLength={100}
                required
              />
            </label>
            <label>
              {messages.parentFolder}
              <select
                name="parentId"
                defaultValue={activeFolder.parentId ?? ''}
              >
                <option value="">{messages.libraryRoot}</option>
                {flatFolders
                  .filter((folder) => !unavailableParentIds.has(folder.id))
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {'— '.repeat(folder.depth)}
                      {folder.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {messages.folderCover}
              <select
                name="coverMode"
                defaultValue={
                  activeFolder.coverBookId
                    ? 'book'
                    : activeFolder.customCoverKey
                      ? 'upload'
                      : 'none'
                }
              >
                <option value="none">{messages.noFolderCover}</option>
                <option value="book">{messages.bookFolderCover}</option>
                <option value="upload">{messages.uploadFolderCover}</option>
              </select>
            </label>
            <label>
              {messages.coverBook}
              <select
                name="coverBookId"
                defaultValue={activeFolder.coverBookId ?? ''}
              >
                <option value="">{messages.selectCoverBook}</option>
                {coverBooks.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              {messages.customCover}
              <input
                type="file"
                name="customCover"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <p className="text-sm text-ink/60 sm:col-span-2">
              {messages.folderCoverLimit}
            </p>
            <button
              className="h-10 w-10 justify-self-end p-0 sm:col-span-2"
              aria-label={messages.saveFolder}
            >
              <SaveIcon />
            </button>
          </form>
          <form
            action={deleteFolderAction}
            className="mt-5 border-t border-ink/10 pt-5 text-right"
          >
            <input type="hidden" name="folderId" value={activeFolder.id} />
            <p className="mb-3 text-sm text-ink/60">
              {messages.deleteEmptyFolderOnly}
            </p>
            <button
              className="h-10 w-10 bg-rust p-0"
              aria-label={messages.deleteFolder}
            >
              <DeleteIcon />
            </button>
          </form>
        </details>
      )}

      {childFolders.length > 0 && (
        <section className="mt-8" aria-labelledby="folders-heading">
          <h2 id="folders-heading" className="font-serif text-2xl font-bold">
            {messages.folders}
          </h2>
          <div
            id="library-folder-list"
            className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {childFolders.map((folder) => {
              const coverSrc = folder.customCoverKey
                ? `/api/folders/${folder.id}/cover`
                : folder.coverBook?.coverKey
                  ? `/api/covers/${folder.coverBook.coverKey}`
                  : null
              return (
                <Link
                  key={folder.id}
                  className="group overflow-hidden rounded-2xl border border-ink/10 bg-white/80 shadow-sm transition hover:-translate-y-1 hover:shadow-card"
                  href={`/libraries/${id}?folder=${folder.id}`}
                >
                  <div className="aspect-[4/3] bg-moss/10">
                    {coverSrc ? (
                      <img
                        className="h-full w-full object-cover"
                        src={coverSrc}
                        alt={messages.folderCoverAlt.replace(
                          '{title}',
                          folder.title,
                        )}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center font-serif text-lg font-bold text-moss/50">
                        {messages.noFolderCover}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-serif text-2xl font-bold group-hover:text-moss">
                      {folder.title}
                    </h3>
                    <p className="mt-2 text-sm text-ink/60">
                      {messages.folderContents
                        .replace('{folders}', String(folder._count.children))
                        .replace('{books}', String(folder._count.books))}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

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
