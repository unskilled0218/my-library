export type FolderNode = {
  id: string
  title: string
  parentId: string | null
}

export function normalizeFolderTitle(input: string) {
  const title = input.trim().slice(0, 100)
  if (!title) throw new Error('Folder title is required')
  return title
}

function folderMap(folders: FolderNode[]) {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

export function folderBreadcrumbs(folders: FolderNode[], folderId: string) {
  const byId = folderMap(folders)
  const result: FolderNode[] = []
  const seen = new Set<string>()
  let current = byId.get(folderId)
  while (current) {
    if (seen.has(current.id)) throw new Error('Folder cycle detected')
    seen.add(current.id)
    result.unshift(current)
    if (result.length > folders.length) throw new Error('Folder cycle detected')
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  if (!result.length || result.at(-1)?.id !== folderId)
    throw new Error('Folder not found')
  return result
}

export function folderDescendantIds(folders: FolderNode[], folderId: string) {
  const descendants = new Set<string>()
  let changed = true
  for (let pass = 0; changed && pass <= folders.length; pass += 1) {
    changed = false
    for (const folder of folders) {
      if (
        folder.parentId &&
        (folder.parentId === folderId || descendants.has(folder.parentId)) &&
        !descendants.has(folder.id)
      ) {
        descendants.add(folder.id)
        changed = true
      }
    }
  }
  if (descendants.has(folderId)) throw new Error('Folder cycle detected')
  return descendants
}

export function flattenedFolders(folders: FolderNode[]) {
  const children = new Map<string | null, FolderNode[]>()
  for (const folder of folders) {
    const siblings = children.get(folder.parentId) ?? []
    siblings.push(folder)
    children.set(folder.parentId, siblings)
  }
  for (const siblings of children.values())
    siblings.sort((a, b) => a.title.localeCompare(b.title))

  const result: { id: string; title: string; depth: number }[] = []
  const visited = new Set<string>()
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of children.get(parentId) ?? []) {
      if (visited.has(folder.id)) throw new Error('Folder cycle detected')
      visited.add(folder.id)
      result.push({ id: folder.id, title: folder.title, depth })
      visit(folder.id, depth + 1)
    }
  }
  visit(null, 0)
  if (visited.size !== folders.length) throw new Error('Invalid folder tree')
  return result
}
