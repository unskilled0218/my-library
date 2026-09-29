import Link from 'next/link'
import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { ImportPanel } from '@/components/import-panel'
import { getLanguage } from '@/lib/i18n/server'
import { transferMessages } from '@/lib/i18n/transfer'

export default async function TransferPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  await requireLibraryAccess(user, id, 'OWNER')
  const messages = transferMessages[await getLanguage()]
  return (
    <div
      id={`library-transfer-page-${id}`}
      className="mx-auto max-w-4xl px-5 py-12 md:px-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{messages.eyebrow}</p>
          <h1 className="mt-2 font-serif text-5xl font-black">
            {messages.title}
          </h1>
        </div>
        <Link
          className="button button-secondary"
          href={`/libraries/${id}/settings`}
        >
          {messages.backToSettings}
        </Link>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="panel">
          <h2 className="font-serif text-3xl font-bold">{messages.export}</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            {messages.exportBody}
          </p>
          <div className="mt-5 flex gap-2">
            <a
              className="button"
              href={`/api/libraries/${id}/transfer?format=json`}
            >
              {messages.downloadJson}
            </a>
            <a
              className="button button-secondary"
              href={`/api/libraries/${id}/transfer?format=csv`}
            >
              {messages.downloadCsv}
            </a>
          </div>
        </section>
        <section className="panel">
          <h2 className="font-serif text-3xl font-bold">{messages.import}</h2>
          <p className="mt-3 mb-5 text-sm text-ink/60">{messages.importBody}</p>
          <ImportPanel libraryId={id} />
        </section>
      </div>
    </div>
  )
}
