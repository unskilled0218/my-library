import { requireLibraryAccess } from '@/lib/access'
import { currentUser } from '@/lib/auth'
import { readCover } from '@/lib/covers'
import { db } from '@/lib/db'

type Context = { params: Promise<{ id: string }> }

const notFound = () => new Response('Not found', { status: 404 })

export async function GET(_request: Request, { params }: Context) {
  const user = await currentUser()
  if (!user) return notFound()
  const { id } = await params
  const folder = await db.libraryFolder.findUnique({
    where: { id },
    select: {
      libraryId: true,
      customCoverKey: true,
      customCoverMime: true,
    },
  })
  if (!folder?.customCoverKey || !folder.customCoverMime) return notFound()
  try {
    await requireLibraryAccess(user, folder.libraryId, 'READ')
    const body = await readCover(folder.customCoverKey)
    return new Response(body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'Content-Length': String(body.length),
        'Content-Type': folder.customCoverMime,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFound()
  }
}
