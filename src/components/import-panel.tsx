'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/locale-provider'
import { formatCount } from '@/lib/i18n/config'
import { transferErrorKeys, transferMessages } from '@/lib/i18n/transfer'

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
  const language = useLanguage()
  const router = useRouter()
  const messages = transferMessages[language]
  const [file, setFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<{
    books: number
    duplicates: number
    willCreate: number
    libraries?: number
  } | null>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const summaryText = summary
    ? [
        ...(summary.libraries === undefined
          ? []
          : [
              `${summary.libraries}${language === 'KO' ? '' : ' '}${messages.librariesUnit}`,
            ]),
        `${summary.books}${language === 'KO' ? '' : ' '}${messages.recordsUnit}`,
        `${summary.duplicates}${language === 'KO' ? '' : ' '}${messages.duplicatesUnit}`,
        `${summary.willCreate}${language === 'KO' ? '' : ' '}${messages.newBooksUnit}`,
      ].join(' · ')
    : ''

  async function send(apply: boolean) {
    if (!file) return
    setPending(true)
    setMessage(messages.working)
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
      if (!response.ok) {
        const errorKey =
          transferErrorKeys[result.error as keyof typeof transferErrorKeys]
        return setMessage(errorKey ? messages[errorKey] : messages.importFailed)
      }
      if (!apply) {
        setSummary(result)
        setMessage(messages.previewReady)
      } else {
        const books = formatCount(language, result.imported, '권', 'book')
        const duplicates = formatCount(
          language,
          result.skipped,
          '개 중복 항목',
          'duplicate',
        )
        setMessage(
          account
            ? messages.accountImportResult
                .replace(
                  '{libraries}',
                  formatCount(
                    language,
                    result.libraries,
                    '개 서재',
                    'library',
                    'libraries',
                  ),
                )
                .replace('{books}', books)
            : messages.libraryImportResult
                .replace('{books}', books)
                .replace('{duplicates}', duplicates),
        )
        setSummary(null)
        if (account) router.refresh()
      }
    } catch {
      setMessage(messages.importFailed)
    } finally {
      setPending(false)
    }
  }

  return (
    <div id={id}>
      <label className="sr-only" htmlFor={`${id}-file`}>
        {messages.importFile}
      </label>
      <input
        id={`${id}-file`}
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
        {messages.previewImport}
      </button>
      {summary && (
        <div className="mt-4 rounded-xl bg-gold/15 p-4 text-sm">
          <p>{summaryText}</p>
          <button
            className="mt-3"
            type="button"
            disabled={pending}
            onClick={() => send(true)}
          >
            {messages.applyImport}
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
