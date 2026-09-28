'use client'

import { useState } from 'react'

export function ImportPanel({ libraryId }: { libraryId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<{
    books: number
    duplicates: number
    willCreate: number
  } | null>(null)
  const [message, setMessage] = useState('')

  async function send(apply: boolean) {
    if (!file) return
    setMessage('Working...')
    const body = new FormData()
    body.set('file', file)
    body.set('apply', String(apply))
    const response = await fetch(`/api/libraries/${libraryId}/transfer`, {
      method: 'POST',
      body,
    })
    const result = await response.json()
    if (!response.ok) return setMessage(result.error ?? 'Import failed')
    if (!apply) {
      setSummary(result)
      setMessage('Preview ready')
    } else {
      setMessage(
        `Imported ${result.imported}; skipped ${result.skipped} duplicates.`,
      )
      setSummary(null)
    }
  }

  return (
    <div>
      <input
        type="file"
        accept=".json,.csv,application/json,text/csv"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null)
          setSummary(null)
        }}
      />
      <button
        className="mt-3"
        type="button"
        disabled={!file}
        onClick={() => send(false)}
      >
        Preview import
      </button>
      {summary && (
        <div className="mt-4 rounded-xl bg-gold/15 p-4 text-sm">
          <p>
            {summary.books} records · {summary.duplicates} duplicates ·{' '}
            {summary.willCreate} new books
          </p>
          <button className="mt-3" type="button" onClick={() => send(true)}>
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
