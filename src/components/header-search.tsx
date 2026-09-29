'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CameraIcon, SearchIcon } from '@/components/icons'
import { IsbnScanner } from '@/components/isbn-scanner'
import { useLanguage } from '@/components/locale-provider'
import type { SearchSource } from '@/lib/global-search'
import { commonMessages } from '@/lib/i18n/common'
import { searchMessages } from '@/lib/i18n/search'

export function HeaderSearch({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const form = useRef<HTMLFormElement>(null)
  const language = useLanguage()
  const messages = searchMessages[language]
  const common = commonMessages[language]
  const submittedSource =
    pathname === '/search' ? searchParams.get('source') : null
  const currentSource: SearchSource = authenticated
    ? submittedSource === 'kyobo' || submittedSource === 'library'
      ? submittedSource
      : 'all'
    : 'kyobo'
  const [scannerOpen, setScannerOpen] = useState(false)

  function handleDetected(isbn: string) {
    const selectedSource = form.current
      ? String(new FormData(form.current).get('source'))
      : currentSource
    setScannerOpen(false)
    router.push(
      `/search?${new URLSearchParams({ q: isbn, source: authenticated ? selectedSource : 'kyobo' })}`,
    )
  }

  return (
    <>
      <form
        ref={form}
        key={`${pathname}-${searchParams.get('q')}-${currentSource}`}
        id="header-search-form"
        action="/search"
        className="flex min-w-0 items-center gap-1.5"
      >
        <input
          id="header-search-input"
          className="min-w-0 flex-1"
          name="q"
          defaultValue={
            pathname === '/search' ? (searchParams.get('q') ?? '') : ''
          }
          placeholder={messages.searchPlaceholder}
          aria-label={messages.searchBooks}
          maxLength={120}
          required
        />
        {authenticated ? (
          <select
            id="header-search-source"
            className="w-24 shrink-0 sm:w-28"
            name="source"
            defaultValue={currentSource}
            aria-label={messages.searchSource}
          >
            <option value="all">{messages.allSources}</option>
            <option value="kyobo">{messages.kyoboSource}</option>
            <option value="library">{messages.librarySource}</option>
          </select>
        ) : (
          <>
            <input type="hidden" name="source" value="kyobo" />
            <span
              id="header-search-source"
              className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-ink/20 bg-white/80 px-3 text-sm"
            >
              {messages.kyoboSource}
            </span>
          </>
        )}
        <button
          id="header-search-submit"
          className="h-10 w-10 shrink-0 p-0"
          type="submit"
          aria-label={common.search}
        >
          <SearchIcon />
        </button>
        <button
          id="header-isbn-camera"
          className="button-secondary h-10 w-10 shrink-0 p-0 sm:hidden"
          type="button"
          aria-label={messages.scanIsbn}
          onClick={() => setScannerOpen(true)}
        >
          <CameraIcon />
        </button>
      </form>
      {scannerOpen && (
        <div
          id="header-scanner-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="header-scanner-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-paper p-5 shadow-card">
            <h2
              id="header-scanner-title"
              className="font-serif text-2xl font-bold"
            >
              {messages.scanTitle}
            </h2>
            <div className="mt-4">
              <IsbnScanner
                onDetected={handleDetected}
                onClose={() => setScannerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
