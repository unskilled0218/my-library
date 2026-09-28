import { toggleUserDisabledAction } from '@/app/actions'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const { q = '' } = await searchParams
  const [users, events] = await Promise.all([
    db.user.findMany({
      where: q ? { loginId: { contains: q, mode: 'insensitive' } } : {},
      include: { _count: { select: { libraries: true, memberships: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.auditLog.findMany({
      where: { actorType: 'ADMIN' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
      <p className="eyebrow">Separate administrator realm</p>
      <h1 className="mt-2 font-serif text-5xl font-black">User management</h1>
      <form className="panel mt-8 flex gap-3">
        <input name="q" defaultValue={q} placeholder="Search login IDs" />
        <button>Search</button>
      </form>
      <div className="mt-6 overflow-x-auto rounded-3xl border border-ink/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink text-white">
            <tr>
              <th className="p-4">Login ID</th>
              <th>Libraries</th>
              <th>Shared</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-ink/10">
                <td className="p-4 font-semibold">{user.loginId}</td>
                <td>{user._count.libraries}</td>
                <td>{user._count.memberships}</td>
                <td>{user.disabledAt ? 'Disabled' : 'Active'}</td>
                <td>
                  <form action={toggleUserDisabledAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button className="button-secondary my-2">
                      {user.disabledAt ? 'Enable' : 'Disable'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel mt-8">
        <h2 className="font-serif text-3xl font-bold">
          Administrator audit events
        </h2>
        <div className="mt-4 divide-y divide-ink/10">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <span>
                {event.action.replaceAll('_', ' ')} · {event.targetType}
              </span>
              <time className="text-ink/50">
                {event.createdAt.toLocaleString()}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
