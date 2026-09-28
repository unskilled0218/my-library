import Link from 'next/link'
import { createLibraryAction } from '@/app/actions'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function LibrariesPage() {
  const user = await requireUser()
  const libraries = await db.library.findMany({
    where: {
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    include: {
      _count: { select: { books: true } },
      members: { where: { userId: user.id }, select: { role: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Collections</p>
          <h1 className="mt-2 font-serif text-5xl font-black">
            Your libraries
          </h1>
        </div>
      </div>
      <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {libraries.map((library) => (
          <Link
            key={library.id}
            className="panel group transition hover:-translate-y-1"
            href={`/libraries/${library.id}`}
          >
            <div className="flex justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-rust">
                {library.ownerId === user.id
                  ? 'Owner'
                  : library.members[0]?.role}
              </span>
              <span className="text-sm text-ink/50">
                {library._count.books} books
              </span>
            </div>
            <h2 className="mt-12 font-serif text-3xl font-bold group-hover:text-moss">
              {library.name}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm text-ink/60">
              {library.description || 'No description yet.'}
            </p>
          </Link>
        ))}
        {libraries.length === 0 && (
          <p className="text-ink/60">No libraries yet.</p>
        )}
      </div>
      <form
        action={createLibraryAction}
        className="panel mt-10 grid gap-4 md:grid-cols-[1fr_2fr_auto]"
      >
        <input
          name="name"
          placeholder="New library name"
          required
          maxLength={100}
        />
        <input
          name="description"
          placeholder="What belongs here?"
          maxLength={500}
        />
        <button type="submit">Create library</button>
      </form>
    </div>
  )
}
