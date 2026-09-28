import type { Genre, Prisma } from '@prisma/client'
import type { GenrePath } from '@/lib/kyobo'
import { kyoboGenreUrlSchema } from '@/lib/validation'

export async function upsertGenrePaths(
  tx: Prisma.TransactionClient,
  paths: GenrePath[],
) {
  if (paths.length === 0) throw new Error('At least one genre path is required')
  const leafIds: string[] = []
  for (const path of paths) {
    if (path.length === 0 || path.length > 12)
      throw new Error('Invalid genre path')
    let parentId: string | null = null
    for (const node of path) {
      const name = node.name.trim()
      if (!name || name.length > 100) throw new Error('Invalid genre name')
      const url = kyoboGenreUrlSchema.parse(node.url)
      const existing = await tx.genre.findUnique({ where: { url } })
      if (existing && existing.parentId !== parentId)
        throw new Error('Genre URL conflicts with an existing tree path')
      const genre: Genre =
        existing ?? (await tx.genre.create({ data: { name, url, parentId } }))
      parentId = genre.id
    }
    if (parentId) leafIds.push(parentId)
  }
  return [...new Set(leafIds)]
}

export async function genrePath(tx: Prisma.TransactionClient, genreId: string) {
  const path: { name: string; url: string }[] = []
  let current: string | null = genreId
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current)) throw new Error('Genre cycle detected')
    seen.add(current)
    const genre: {
      id: string
      name: string
      url: string
      parentId: string | null
    } | null = await tx.genre.findUnique({ where: { id: current } })
    if (!genre) break
    path.unshift({ name: genre.name, url: genre.url })
    current = genre.parentId
  }
  return path
}
