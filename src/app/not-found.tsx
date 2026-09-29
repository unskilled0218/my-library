import Link from 'next/link'
import { getLanguage } from '@/lib/i18n/server'
import { shellMessages } from '@/lib/i18n/shell'

export default async function NotFound() {
  const messages = shellMessages[await getLanguage()]
  return (
    <div
      id="not-found-page"
      className="mx-auto max-w-xl px-5 py-28 text-center"
    >
      <p className="eyebrow">{messages.notFoundEyebrow}</p>
      <h1 className="mt-3 font-serif text-5xl font-black">
        {messages.notFoundTitle}
      </h1>
      <p className="mt-5 text-ink/60">{messages.notFoundBody}</p>
      <Link className="button mt-8" href="/libraries">
        {messages.returnLibraries}
      </Link>
    </div>
  )
}
