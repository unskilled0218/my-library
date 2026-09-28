import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'

function tally(values: string[]) {
  return [
    ...values.reduce(
      (map, value) => map.set(value, (map.get(value) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1])
}

export default async function StatsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  await requireLibraryAccess(user, id, 'READ')
  const books = await db.book.findMany({
    where: { libraryId: id },
    include: {
      genres: { include: { genre: true } },
      locationTag: true,
    },
  })
  const stats = [
    ['Total books', books.length],
    ['Finished', books.filter((book) => book.readingState === 'DONE').length],
    [
      'Currently reading',
      books.filter((book) => book.readingState === 'READING').length,
    ],
    [
      'Average rating',
      books.filter((book) => book.rating).length
        ? (
            books.reduce((sum, book) => sum + (book.rating ?? 0), 0) /
            books.filter((book) => book.rating).length
          ).toFixed(1)
        : '—',
    ],
  ]
  const groups = [
    [
      'Reading state',
      tally(books.map((book) => book.readingState.replace('_', ' '))),
    ],
    ['Format', tally(books.map((book) => book.format))],
    [
      'Genre',
      tally(
        books.flatMap((book) => book.genres.map(({ genre }) => genre.name)),
      ),
    ],
    [
      'Location',
      tally(books.map((book) => book.locationTag?.name ?? 'Unassigned')),
    ],
  ] as const
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
      <p className="eyebrow">Collection health</p>
      <h1 className="mt-2 font-serif text-5xl font-black">
        Library statistics
      </h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([label, number]) => (
          <div className="panel" key={label}>
            <p className="text-sm text-ink/50">{label}</p>
            <p className="mt-2 font-serif text-5xl font-black">{number}</p>
          </div>
        ))}
      </div>
      {books.length ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {groups.map(([title, rows]) => (
            <section className="panel" key={title}>
              <h2 className="font-serif text-2xl font-bold">{title}</h2>
              <div className="mt-4 space-y-3">
                {rows.slice(0, 8).map(([label, count]) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm">
                      <span>{label}</span>
                      <span>{count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-ink/10">
                      <div
                        className="h-2 rounded-full bg-moss"
                        style={{
                          width: `${Math.max(4, (count / books.length) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="panel mt-8 text-center">
          Add books to see collection statistics.
        </div>
      )}
    </div>
  )
}
