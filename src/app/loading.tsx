export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-5 py-16">
      <div className="h-4 w-32 rounded bg-moss/20" />
      <div className="mt-5 h-16 max-w-xl rounded bg-ink/10" />
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-64 rounded-3xl bg-ink/10" />
        ))}
      </div>
    </div>
  )
}
