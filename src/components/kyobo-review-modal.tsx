'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/locale-provider'
import { commonMessages } from '@/lib/i18n/common'
import { searchMessages } from '@/lib/i18n/search'

export function KyoboReviewModal({
  children,
  closeHref,
}: {
  children: ReactNode
  closeHref: string
}) {
  const closeLink = useRef<HTMLAnchorElement>(null)
  const router = useRouter()
  const language = useLanguage()
  const messages = searchMessages[language]
  const common = commonMessages[language]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeLink.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') router.push(closeHref)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [closeHref, router])

  return (
    <div
      id="kyobo-review-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kyobo-review-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) router.push(closeHref)
      }}
    >
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-paper p-5 shadow-card sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="kyobo-review-dialog-title"
            className="font-serif text-2xl font-bold"
          >
            {messages.kyoboDetails}
          </h2>
          <Link
            ref={closeLink}
            className="button button-secondary shrink-0"
            href={closeHref}
            scroll={false}
          >
            {common.close}
          </Link>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
