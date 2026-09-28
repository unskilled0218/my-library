import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  await requireLibraryAccess(user, id, 'OWNER')
  const events = await db.auditLog.findMany({
    where: { libraryId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <p className="eyebrow">Immutable history</p>
      <h1 className="mt-2 font-serif text-5xl font-black">Audit log</h1>
      <div className="panel mt-8 divide-y divide-ink/10">
        {events.map((event) => (
          <div key={event.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex justify-between gap-4">
              <p className="font-semibold">
                {event.action.replaceAll('_', ' ')}
              </p>
              <time className="text-xs text-ink/50">
                {event.createdAt.toLocaleString()}
              </time>
            </div>
            <p className="mt-1 text-xs text-ink/50">
              {event.actorType} · {event.targetType} {event.targetId}
            </p>
          </div>
        ))}
        {events.length === 0 && <p>No audited actions yet.</p>}
      </div>
    </div>
  )
}
