import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { importKyoboBook } from '@/lib/kyobo-import'
import type { KyoboRequestResult } from '@/lib/book-options'

function json(result: KyoboRequestResult, status = 200) {
  return Response.json(result, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    const url = new URL(origin)
    // The reverse proxy supplies the public origin; Next's URL may use HTTP internally.
    const host =
      request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      new URL(request.url).host
    const protocol =
      request.headers.get('x-forwarded-proto') ??
      new URL(request.url).protocol.slice(0, -1)
    return (
      ['http', 'https'].includes(protocol) &&
      url.origin === `${protocol}://${host}` &&
      url.origin === origin
    )
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ status: 'error', error: 'invalidRequest' }, 403)
  const user = await currentUser()
  if (!user) return json({ status: 'error', error: 'signInRequired' }, 401)
  let form: FormData
  try {
    form = await request.formData()
    if ([...form.values()].some((value) => typeof value !== 'string'))
      throw new Error('Invalid input')
  } catch {
    return json({ status: 'error', error: 'invalidRequest' }, 400)
  }
  try {
    const result = await importKyoboBook(user, form)
    if (result.status === 'created') {
      revalidatePath(`/libraries/${result.libraryId}`)
      revalidatePath('/')
      revalidatePath('/libraries')
    }
    return json(result, result.status === 'error' ? 422 : 200)
  } catch (error) {
    console.error('Kyobo import failed', error)
    return json({ status: 'error', error: 'saveFailed' }, 500)
  }
}
