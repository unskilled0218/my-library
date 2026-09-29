'use client'

import { useState } from 'react'

export function ImportPanel({
  libraryId,
  endpoint,
  id = 'library-import-panel',
  account = false,
}: {
  libraryId?: string
  endpoint?: string
  id?: string
  account?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<{
    books: number
    duplicates: number
    willCreate: number
    libraries?: number
  } | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function send(apply: boolean) {
    if (!file) return
    setPending(true)
    setMessage('Working...')
    try {
      const body = new FormData()
      body.set('file', file)
      body.set('apply', String(apply))
      const response = await fetch(
        endpoint ?? `/api/libraries/${libraryId}/transfer`,
        {
          method: 'POST',
          body,
        },
      )
      const result = await response.json()
      if (!response.ok) return setMessage(result.error ?? 'Import failed')
      if (!apply) {
        setSummary(result)
        setMessage('Preview ready')
      } else {
        setMessage(
          account
            ? `Imported ${result.libraries} libraries and ${result.imported} books.`
            : `Imported ${result.imported}; skipped ${result.skipped} duplicates.`,
        )
        setSummary(null)
      }
    } catch {
      setMessage('Import failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div id={id}>
      <input
        type="file"
        accept={
          account
            ? '.json,application/json'
            : '.json,.csv,application/json,text/csv'
        }
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null)
          setSummary(null)
        }}
      />
      <button
        className="mt-3"
        type="button"
        disabled={!file || pending}
        onClick={() => send(false)}
      >
        Preview import
      </button>
      {summary && (
        <div className="mt-4 rounded-xl bg-gold/15 p-4 text-sm">
          <p>
            {summary.libraries !== undefined &&
              `${summary.libraries} libraries · `}
            {summary.books} records · {summary.duplicates} duplicates ·{' '}
            {summary.willCreate} new books
          </p>
          <button
            className="mt-3"
            type="button"
            disabled={pending}
            onClick={() => send(true)}
          >
            Apply import
          </button>
        </div>
      )}
      {message && (
        <p className="mt-3 text-sm" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
