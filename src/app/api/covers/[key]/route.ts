import { requireLibraryAccess } from '@/lib/access'
import { currentUser } from '@/lib/auth'
import { readCover } from '@/lib/covers'
import { db } from '@/lib/db'

const notFound = () =>
  new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await currentUser()
  if (!user) return notFound()
  const { key } = await params
  const book = await db.book.findFirst({
    where: { coverKey: key },
    select: { libraryId: true, coverMime: true },
  })
  if (!book?.coverMime) return notFound()
  try {
    await requireLibraryAccess(user, book.libraryId, 'READ')
    const bytes = await readCover(key)
    return new Response(bytes, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Length': String(bytes.length),
        'Content-Type': book.coverMime,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFound()
  }
}
