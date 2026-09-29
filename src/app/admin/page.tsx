import { toggleUserDisabledAction } from '@/app/actions'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  adminMessages,
  auditActionKeys,
  auditTargetKeys,
} from '@/lib/i18n/admin'
import { formatDateTime } from '@/lib/i18n/config'
import { getCookieLanguage } from '@/lib/i18n/server'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdmin()
  const { q = '' } = await searchParams
  const [language, users, events] = await Promise.all([
    getCookieLanguage(),
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
  const messages = adminMessages[language]
  return (
    <div
      id="admin-dashboard-page"
      className="mx-auto max-w-7xl px-5 py-12 md:px-8"
    >
      <p className="eyebrow">{messages.adminEyebrow}</p>
      <h1 className="mt-2 font-serif text-5xl font-black">
        {messages.userManagement}
      </h1>
      <form className="panel mt-8 flex gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder={messages.searchLoginIds}
          aria-label={messages.searchLoginIds}
        />
        <button>{messages.search}</button>
      </form>
      <div className="mt-6 overflow-x-auto rounded-3xl border border-ink/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink text-white">
            <tr>
              <th className="p-4">{messages.loginId}</th>
              <th>{messages.libraries}</th>
              <th>{messages.shared}</th>
              <th>{messages.status}</th>
              <th>{messages.action}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-ink/10">
                <td className="p-4 font-semibold">{user.loginId}</td>
                <td>{user._count.libraries}</td>
                <td>{user._count.memberships}</td>
                <td>{user.disabledAt ? messages.disabled : messages.active}</td>
                <td>
                  <form action={toggleUserDisabledAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button className="button-secondary my-2">
                      {user.disabledAt ? messages.enable : messages.disable}
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
          {messages.adminAuditEvents}
        </h2>
        <div className="mt-4 divide-y divide-ink/10">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <span>
                {messages[
                  auditActionKeys[event.action as keyof typeof auditActionKeys]
                ] ?? event.action}{' '}
                ·{' '}
                {messages[
                  auditTargetKeys[
                    event.targetType as keyof typeof auditTargetKeys
                  ]
                ] ?? event.targetType}
              </span>
              <time className="text-ink/50">
                {formatDateTime(language, event.createdAt)}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
