import { redirect } from 'next/navigation'
import { requireLibraryAccess } from '@/lib/access'
import { requireUser } from '@/lib/auth'
import { normalizeSearchQuery } from '@/lib/global-search'
import { appendSearchContext, isKyoboSaleId } from '@/lib/kyobo-preview'

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
  const destination = appendSearchContext(new URLSearchParams(), {
    q: normalizeSearchQuery(query.q),
    source: 'kyobo',
    libraryId: id,
  })
  redirect(
    isKyoboSaleId(query.selected)
      ? `/search/kyobo/${query.selected}?${destination}`
      : `/search?${destination}`,
  )
}
