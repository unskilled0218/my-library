'use client'

import { startTransition, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/locale-provider'
import { booksMessages } from '@/lib/i18n/books'

const types = ['EPUB', 'PDF'] as const
type FileType = (typeof types)[number]

type BookFile = {
  type: FileType
  originalName: string
  size: number
}

const maxBytes = 100 * 1024 * 1024

function formatSize(language: 'KO' | 'EN', bytes: number) {
  const megabytes = bytes / (1024 * 1024)
  if (megabytes >= 1)
    return `${new Intl.NumberFormat(language === 'KO' ? 'ko-KR' : 'en-US', { maximumFractionDigits: 1 }).format(megabytes)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function BookFilesPanel({
  bookId,
  files,
  canWrite,
}: {
  bookId: string
  files: BookFile[]
  canWrite: boolean
}) {
  const language = useLanguage()
  const messages = booksMessages[language]
  const router = useRouter()
  const [pendingType, setPendingType] = useState<FileType | null>(null)
  const [status, setStatus] = useState('')
  const records = new Map(files.map((file) => [file.type, file]))

  async function upload(event: FormEvent<HTMLFormElement>, type: FileType) {
    event.preventDefault()
    const form = event.currentTarget
    const input = form.elements.namedItem('file')
    const file = input instanceof HTMLInputElement ? input.files?.[0] : null
    if (!file?.size) {
      setStatus(messages.invalidBookFile)
      return
    }
    if (file.size > maxBytes) {
      setStatus(messages.bookFileTooLarge)
      return
    }
    setPendingType(type)
    setStatus('')
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch(`/api/books/${bookId}/files/${type}`, {
        method: 'POST',
        body,
      })
      const result = (await response.json().catch(() => null)) as {
        error?: string
        replaced?: boolean
      } | null
      if (!response.ok) {
        setStatus(
          result?.error === 'file-too-large'
            ? messages.bookFileTooLarge
            : result?.error === 'invalid-file'
              ? messages.invalidBookFile
              : messages.bookFileFailed,
        )
        return
      }
      form.reset()
      setStatus(
        result?.replaced
          ? messages.bookFileReplaced
          : messages.bookFileUploaded,
      )
      startTransition(() => router.refresh())
    } catch {
      setStatus(messages.bookFileFailed)
    } finally {
      setPendingType(null)
    }
  }

  async function remove(type: FileType) {
    setPendingType(type)
    setStatus('')
    try {
      const response = await fetch(`/api/books/${bookId}/files/${type}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        setStatus(messages.bookFileFailed)
        return
      }
      setStatus(messages.bookFileRemoved)
      startTransition(() => router.refresh())
    } catch {
      setStatus(messages.bookFileFailed)
    } finally {
      setPendingType(null)
    }
  }

  return (
    <section className="panel mt-8" aria-labelledby="book-files-heading">
      <h2 id="book-files-heading" className="font-serif text-2xl font-bold">
        {messages.bookFiles}
      </h2>
      <p className="mt-2 text-sm text-ink/60">{messages.bookFilesBody}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {types.map((type) => {
          const record = records.get(type)
          const typeLabel = type === 'EPUB' ? messages.epub : messages.pdf
          return (
            <div key={type} className="rounded-2xl border border-ink/10 p-4">
              <h3 className="font-bold">{typeLabel}</h3>
              {record ? (
                <div className="mt-2 text-sm">
                  <a
                    className="break-all font-semibold text-moss underline"
                    href={`/api/books/${bookId}/files/${type}`}
                    aria-label={messages.downloadBookFile.replace(
                      '{type}',
                      typeLabel,
                    )}
                  >
                    {record.originalName}
                  </a>
                  <span className="ml-2 text-ink/50">
                    {formatSize(language, record.size)}
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink/50">
                  {messages.noBookFile}
                </p>
              )}
              {canWrite && (
                <div className="mt-4 space-y-3">
                  <form
                    className="space-y-2"
                    encType="multipart/form-data"
                    onSubmit={(event) => upload(event, type)}
                  >
                    <label className="block text-sm font-semibold">
                      {messages.chooseBookFile.replace('{type}', typeLabel)}
                      <input
                        className="mt-1"
                        name="file"
                        type="file"
                        required
                        accept={
                          type === 'EPUB'
                            ? '.epub,application/epub+zip'
                            : '.pdf,application/pdf'
                        }
                      />
                    </label>
                    <button disabled={pendingType !== null}>
                      {(record
                        ? messages.replaceBookFile
                        : messages.uploadBookFile
                      ).replace('{type}', typeLabel)}
                    </button>
                  </form>
                  {record && (
                    <button
                      className="bg-rust"
                      type="button"
                      disabled={pendingType !== null}
                      onClick={() => remove(type)}
                    >
                      {messages.removeBookFile.replace('{type}', typeLabel)}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {canWrite && (
        <p className="mt-4 text-xs text-ink/50">{messages.bookFileLimit}</p>
      )}
      <p className="mt-3 text-sm font-semibold text-rust" aria-live="polite">
        {pendingType ? messages.bookFileWorking : status}
      </p>
    </section>
  )
}
