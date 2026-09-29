import Link from 'next/link'
import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  adminMessages,
  auditActionKeys,
  auditActorKeys,
  auditTargetKeys,
} from '@/lib/i18n/admin'
import { formatDateTime } from '@/lib/i18n/config'
import { getLanguage } from '@/lib/i18n/server'

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  await requireLibraryAccess(user, id, 'OWNER')
  const [language, events] = await Promise.all([
    getLanguage(),
    db.auditLog.findMany({
      where: { libraryId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])
  const messages = adminMessages[language]
  return (
    <div
      id={`library-audit-page-${id}`}
      className="mx-auto max-w-4xl px-5 py-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{messages.immutableHistory}</p>
          <h1 className="mt-2 font-serif text-5xl font-black">
            {messages.auditLog}
          </h1>
        </div>
        <Link
          className="button button-secondary"
          href={`/libraries/${id}/settings`}
        >
          {messages.backToSettings}
        </Link>
      </div>
      <div className="panel mt-8 divide-y divide-ink/10">
        {events.map((event) => (
          <div key={event.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex justify-between gap-4">
              <p className="font-semibold">
                {messages[
                  auditActionKeys[event.action as keyof typeof auditActionKeys]
                ] ?? event.action}
              </p>
              <time className="text-xs text-ink/50">
                {formatDateTime(language, event.createdAt)}
              </time>
            </div>
            <p className="mt-1 text-xs text-ink/50">
              {messages[auditActorKeys[event.actorType]]} ·{' '}
              {messages[
                auditTargetKeys[
                  event.targetType as keyof typeof auditTargetKeys
                ]
              ] ?? event.targetType}{' '}
              {event.targetId}
            </p>
          </div>
        ))}
        {events.length === 0 && <p>{messages.noAuditEvents}</p>}
      </div>
    </div>
  )
}
