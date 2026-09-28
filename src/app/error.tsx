'use client'

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="mx-auto max-w-xl px-5 py-28 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 font-serif text-5xl font-black">
        The bookmark slipped.
      </h1>
      <p className="mt-5 text-ink/60">
        No changes were intentionally hidden. Try the action again.
      </p>
      <button className="mt-8" onClick={reset}>
        Try again
      </button>
    </div>
  )
}
