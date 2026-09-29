'use client'

import { useLanguage } from '@/components/locale-provider'
import { shellMessages } from '@/lib/i18n/shell'

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const messages = shellMessages[useLanguage()]
  return (
    <div id="error-page" className="mx-auto max-w-xl px-5 py-28 text-center">
      <p className="eyebrow">{messages.errorEyebrow}</p>
      <h1 className="mt-3 font-serif text-5xl font-black">
        {messages.errorTitle}
      </h1>
      <p className="mt-5 text-ink/60">{messages.errorBody}</p>
      <button className="mt-8" onClick={reset}>
        {messages.tryAgain}
      </button>
    </div>
  )
}
