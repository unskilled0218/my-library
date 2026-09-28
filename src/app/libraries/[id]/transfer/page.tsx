import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { ImportPanel } from '@/components/import-panel'

export default async function TransferPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  await requireLibraryAccess(user, id, 'OWNER')
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <p className="eyebrow">Portability</p>
      <h1 className="mt-2 font-serif text-5xl font-black">Import and export</h1>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="panel">
          <h2 className="font-serif text-3xl font-bold">Export</h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            JSON is a lossless backup with settings, genre paths, reading data,
            and cover images. CSV is designed for spreadsheet editing.
          </p>
          <div className="mt-5 flex gap-2">
            <a
              className="button"
              href={`/api/libraries/${id}/transfer?format=json`}
            >
              Download JSON
            </a>
            <a
              className="button button-secondary"
              href={`/api/libraries/${id}/transfer?format=csv`}
            >
              Download CSV
            </a>
          </div>
        </section>
        <section className="panel">
          <h2 className="font-serif text-3xl font-bold">Import</h2>
          <p className="mt-3 mb-5 text-sm text-ink/60">
            Preview validation and duplicates before changing the library.
          </p>
          <ImportPanel libraryId={id} />
        </section>
      </div>
    </div>
  )
}
