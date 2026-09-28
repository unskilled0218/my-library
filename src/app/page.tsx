import Link from 'next/link'

export default function Home() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1.2fr_0.8fr] md:px-8">
      <section>
        <p className="eyebrow">Your shelves, remembered</p>
        <h1 className="mt-5 max-w-4xl font-serif text-6xl font-black leading-[0.95] tracking-[-0.04em] md:text-8xl">
          Every book has a place and a story.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-ink/70">
          Catalog what you own, remember what you read, share a shelf, and find
          any volume again. Built for real collections, from living-room stacks
          to ebooks.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link className="button px-6" href="/register">
            Start a library
          </Link>
          <Link className="button button-secondary px-6" href="/login">
            Open your shelves
          </Link>
        </div>
      </section>
      <aside className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2.5rem] bg-moss p-8 text-paper shadow-card">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border-[28px] border-gold/70" />
        <p className="eyebrow !text-gold">Currently reading</p>
        <div className="mt-28 border-l-2 border-gold pl-6">
          <p className="font-serif text-4xl font-bold">
            A collection should feel lived in.
          </p>
          <p className="mt-5 leading-7 text-paper/70">
            Search by title, author, ISBN, genre, location, or the note you left
            yourself years ago.
          </p>
        </div>
        <div className="absolute bottom-8 left-8 right-8 flex justify-between border-t border-paper/20 pt-5 text-sm">
          <span>List or grid</span>
          <span>Private by default</span>
        </div>
      </aside>
    </div>
  )
}
