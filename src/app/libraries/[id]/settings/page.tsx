import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  deleteLibraryAction,
  removeMemberAction,
  shareLibraryAction,
  updateLibraryAction,
} from '@/app/actions'
import { libraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

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
  const members =
    access === 'OWNER'
      ? await db.libraryMember.findMany({
          where: { libraryId: id },
          include: { user: { select: { id: true, loginId: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : []

  return (
    <div
      id={`library-settings-page-${id}`}
      className="mx-auto max-w-6xl px-5 py-12 md:px-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{access} access</p>
          <h1 className="mt-2 font-serif text-5xl font-black">
            Library settings
          </h1>
          <p className="mt-3 text-ink/60">{library.name}</p>
        </div>
        <Link className="button button-secondary" href={`/libraries/${id}`}>
          Back to library
        </Link>
      </div>
      <nav
        id="library-settings-navigation"
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Library settings"
      >
        <Link
          className="panel transition hover:-translate-y-1"
          href={`/libraries/${id}/stats`}
        >
          <span className="eyebrow">Insights</span>
          <span className="mt-2 block font-serif text-2xl font-bold">
            Statistics
          </span>
        </Link>
        {access === 'OWNER' && (
          <>
            <Link
              className="panel transition hover:-translate-y-1"
              href={`/libraries/${id}/transfer`}
            >
              <span className="eyebrow">Portability</span>
              <span className="mt-2 block font-serif text-2xl font-bold">
                Import / export
              </span>
            </Link>
            <Link
              className="panel transition hover:-translate-y-1"
              href={`/libraries/${id}/audit`}
            >
              <span className="eyebrow">History</span>
              <span className="mt-2 block font-serif text-2xl font-bold">
                Audit log
              </span>
            </Link>
          </>
        )}
      </nav>
      {access === 'OWNER' && (
        <div
          id="library-owner-settings"
          className="mt-8 grid gap-6 lg:grid-cols-2"
        >
          <section id="library-sharing-settings" className="panel">
            <p className="eyebrow">Sharing</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">Members</h2>
            <form
              id="library-share-form"
              action={shareLibraryAction}
              className="mt-5 grid gap-2 sm:grid-cols-[1fr_120px_auto]"
            >
              <input type="hidden" name="libraryId" value={id} />
              <input name="loginId" required placeholder="Login ID" />
              <select name="role" aria-label="Member role">
                <option value="VIEWER">Viewer</option>
                <option value="EDITOR">Editor</option>
              </select>
              <button type="submit">Add</button>
            </form>
            <div className="mt-4 space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink/5 p-3 text-sm"
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
                    <button className="button-secondary" type="submit">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-sm text-ink/60">No members yet.</p>
              )}
            </div>
          </section>
          <section id="library-ownership-settings" className="panel">
            <p className="eyebrow">Ownership</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">
              Library details
            </h2>
            <form
              id="library-details-form"
              action={updateLibraryAction}
              className="mt-5 space-y-3"
            >
              <input type="hidden" name="libraryId" value={id} />
              <label className="block text-sm font-semibold">
                Name
                <input
                  className="mt-1"
                  name="name"
                  defaultValue={library.name}
                  required
                />
              </label>
              <label className="block text-sm font-semibold">
                Description
                <textarea
                  className="mt-1"
                  name="description"
                  defaultValue={library.description}
                  rows={3}
                />
              </label>
              <button type="submit">Save library</button>
            </form>
            <form
              id="delete-library-form"
              action={deleteLibraryAction}
              className="mt-6 border-t border-rust/20 pt-5"
            >
              <input type="hidden" name="libraryId" value={id} />
              <button className="bg-rust" type="submit">
                Delete library
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
