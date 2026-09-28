import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-28 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="mt-3 font-serif text-5xl font-black">
        That shelf is out of reach.
      </h1>
      <p className="mt-5 text-ink/60">
        The item does not exist or you do not have access to it.
      </p>
      <Link className="button mt-8" href="/libraries">
        Return to libraries
      </Link>
    </div>
  )
}
