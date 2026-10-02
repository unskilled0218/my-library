import { describe, expect, it } from 'vitest'
import {
  flattenedFolders,
  folderBreadcrumbs,
  folderDescendantIds,
  normalizeFolderTitle,
} from '@/lib/library-folders'

const folders = [
  { id: 'a', title: 'Alpha', parentId: null },
  { id: 'b', title: 'Beta', parentId: 'a' },
  { id: 'c', title: 'Child', parentId: 'b' },
  { id: 'z', title: 'Zulu', parentId: null },
]

describe('library folders', () => {
  it('normalizes bounded titles', () => {
    expect(normalizeFolderTitle('  Reading  ')).toBe('Reading')
    expect(normalizeFolderTitle('x'.repeat(110))).toHaveLength(100)
    expect(() => normalizeFolderTitle('   ')).toThrow('required')
  })

  it('builds breadcrumbs and descendants', () => {
    expect(folderBreadcrumbs(folders, 'c').map(({ id }) => id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect([...folderDescendantIds(folders, 'a')]).toEqual(['b', 'c'])
  })

  it('flattens roots and descendants in title order', () => {
    expect(flattenedFolders(folders)).toEqual([
      { id: 'a', title: 'Alpha', depth: 0 },
      { id: 'b', title: 'Beta', depth: 1 },
      { id: 'c', title: 'Child', depth: 2 },
      { id: 'z', title: 'Zulu', depth: 0 },
    ])
  })

  it('rejects cycles and orphaned trees', () => {
    const cycle = [
      { id: 'a', title: 'A', parentId: 'b' },
      { id: 'b', title: 'B', parentId: 'a' },
    ]
    expect(() => folderBreadcrumbs(cycle, 'a')).toThrow('cycle')
    expect(() => folderDescendantIds(cycle, 'a')).toThrow('cycle')
    expect(() => flattenedFolders(cycle)).toThrow('Invalid')
  })
})
