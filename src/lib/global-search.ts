export type SearchSource = 'all' | 'kyobo' | 'library'

export function normalizeSearchSource(
  source: string | undefined,
  authenticated: boolean,
): SearchSource {
  if (!authenticated) return 'kyobo'
  return source === 'kyobo' || source === 'library' ? source : 'all'
}

export function normalizeSearchQuery(query: string | undefined) {
  return query?.trim().slice(0, 120) ?? ''
}
