import Link from 'next/link'
import { homeMessages } from '@/lib/i18n/home'
import { getLanguage } from '@/lib/i18n/server'

export default async function Home() {
  const messages = homeMessages[await getLanguage()]
  return (
    <div
      id="home-page"
      className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1.2fr_0.8fr] md:px-8"
    >
      <section id="home-hero">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-serif text-6xl font-black leading-[0.95] tracking-[-0.04em] md:text-8xl">
          {messages.title}
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-ink/70">
          {messages.body}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link className="button px-6" href="/register">
            {messages.start}
          </Link>
          <Link className="button button-secondary px-6" href="/login">
            {messages.open}
          </Link>
        </div>
      </section>
      <aside
        id="home-feature-card"
        className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2.5rem] bg-moss p-8 text-paper shadow-card"
      >
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border-[28px] border-gold/70" />
        <p className="eyebrow !text-gold">{messages.currentlyReading}</p>
        <div className="mt-28 border-l-2 border-gold pl-6">
          <p className="font-serif text-4xl font-bold">{messages.cardTitle}</p>
          <p className="mt-5 leading-7 text-paper/70">{messages.cardBody}</p>
        </div>
        <div className="absolute bottom-8 left-8 right-8 flex justify-between border-t border-paper/20 pt-5 text-sm">
          <span>{messages.layouts}</span>
          <span>{messages.private}</span>
        </div>
      </aside>
    </div>
  )
}
