import { redirect } from 'next/navigation'
import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'

export default async function LegacyLibrarySearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; selected?: string }>
}) {
  const user = await requireUser()
  const [{ id }, query] = await Promise.all([params, searchParams])
  await requireLibraryAccess(user, id, 'WRITE')
  const destination = new URLSearchParams({
    source: 'kyobo',
    libraryId: id,
    ...(query.q ? { q: query.q } : {}),
    ...(query.selected ? { selected: query.selected } : {}),
  })
  redirect(`/search?${destination}`)
}
