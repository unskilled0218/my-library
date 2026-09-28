import { db } from '@/lib/db'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ status: 'ready', database: 'ready' })
  } catch {
    return Response.json(
      { status: 'not_ready', database: 'unavailable' },
      { status: 503 },
    )
  }
}
