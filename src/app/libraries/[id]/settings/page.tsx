import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  deleteLibraryAction,
  removeMemberAction,
  shareLibraryAction,
  updateLibraryAction,
} from '@/app/actions'
import { DeleteIcon, SaveIcon } from '@/components/icons'
import { libraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { commonMessages, enumMessages } from '@/lib/i18n/common'
import { librariesMessages } from '@/lib/i18n/libraries'
import { getLanguage } from '@/lib/i18n/server'

export default async function LibrarySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const access = await libraryAccess(user.id, id)
  if (!access) notFound()
  const library = await db.library.findUnique({
    where: { id },
    select: { id: true, name: true, description: true },
  })
  if (!library) notFound()
  const [members, language] = await Promise.all([
    access === 'OWNER'
      ? db.libraryMember.findMany({
          where: { libraryId: id },
          include: { user: { select: { id: true, loginId: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [],
    getLanguage(),
  ])
  const messages = librariesMessages[language]
  const common = commonMessages[language]

  return (
    <div
      id={`library-settings-page-${id}`}
      data-layout="list"
      className="mx-auto max-w-6xl px-5 py-12 md:px-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {common[enumMessages[access]]} {messages.access}
          </p>
          <h1 className="mt-2 font-serif text-5xl font-black">
            {messages.librarySettings}
          </h1>
          <p className="mt-3 text-ink/60">{library.name}</p>
        </div>
        <Link className="button button-secondary" href={`/libraries/${id}`}>
          {messages.backToLibrary}
        </Link>
      </div>
      <nav
        id="library-settings-navigation"
        className="panel mt-8 divide-y divide-ink/10 overflow-hidden p-0"
        aria-label={messages.settingsNavigation}
      >
        <Link
          className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-ink/5"
          href={`/libraries/${id}/stats`}
        >
          <span>
            <span className="eyebrow">{messages.insights}</span>
            <span className="mt-1 block font-serif text-xl font-bold">
              {messages.statistics}
            </span>
          </span>
          <span className="text-sm font-semibold text-moss" aria-hidden="true">
            {messages.view}
          </span>
        </Link>
        {access === 'OWNER' && (
          <>
            <Link
              className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-ink/5"
              href={`/libraries/${id}/transfer`}
            >
              <span>
                <span className="eyebrow">{messages.portability}</span>
                <span className="mt-1 block font-serif text-xl font-bold">
                  {messages.importExport}
                </span>
              </span>
              <span
                className="text-sm font-semibold text-moss"
                aria-hidden="true"
              >
                {messages.manage}
              </span>
            </Link>
            <Link
              className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-ink/5"
              href={`/libraries/${id}/audit`}
            >
              <span>
                <span className="eyebrow">{messages.history}</span>
                <span className="mt-1 block font-serif text-xl font-bold">
                  {messages.auditLog}
                </span>
              </span>
              <span
                className="text-sm font-semibold text-moss"
                aria-hidden="true"
              >
                {messages.view}
              </span>
            </Link>
          </>
        )}
      </nav>
      {access === 'OWNER' && (
        <div id="library-owner-settings" className="mt-8 space-y-6">
          <section id="library-sharing-settings" className="panel">
            <p className="eyebrow">{messages.sharing}</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">
              {messages.members}
            </h2>
            <form
              id="library-share-form"
              action={shareLibraryAction}
              className="mt-5 grid gap-2 sm:grid-cols-[1fr_120px_auto]"
            >
              <input type="hidden" name="libraryId" value={id} />
              <input name="loginId" required placeholder={messages.loginId} />
              <select name="role" aria-label={messages.memberRole}>
                <option value="VIEWER">{common.viewer}</option>
                <option value="EDITOR">{common.editor}</option>
              </select>
              <button type="submit">{messages.add}</button>
            </form>
            <div className="mt-4 space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink/5 p-3 text-sm"
                >
                  <span>
                    {member.user.loginId} · {common[enumMessages[member.role]]}
                  </span>
                  <form action={removeMemberAction}>
                    <input type="hidden" name="libraryId" value={id} />
                    <input
                      type="hidden"
                      name="memberId"
                      value={member.user.id}
                    />
                    <button className="button-secondary" type="submit">
                      {messages.remove}
                    </button>
                  </form>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-ink/60">{messages.noMembers}</p>
              )}
            </div>
          </section>
          <section id="library-ownership-settings" className="panel">
            <p className="eyebrow">{messages.ownership}</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">
              {messages.libraryDetails}
            </h2>
            <form
              id="library-details-form"
              action={updateLibraryAction}
              className="mt-5 space-y-3"
            >
              <input type="hidden" name="libraryId" value={id} />
              <label className="block text-sm font-semibold">
                {messages.name}
                <input
                  className="mt-1"
                  name="name"
                  defaultValue={library.name}
                  required
                />
              </label>
              <label className="block text-sm font-semibold">
                {messages.description}
                <textarea
                  className="mt-1"
                  name="description"
                  defaultValue={library.description}
                  rows={3}
                />
              </label>
              <button
                className="h-10 w-10 p-0"
                type="submit"
                aria-label={messages.saveLibrary}
              >
                <SaveIcon />
              </button>
            </form>
            <form
              id="delete-library-form"
              action={deleteLibraryAction}
              className="mt-6 border-t border-rust/20 pt-5"
            >
              <input type="hidden" name="libraryId" value={id} />
              <button
                className="h-10 w-10 bg-rust p-0"
                type="submit"
                aria-label={messages.deleteLibrary}
              >
                <DeleteIcon />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
