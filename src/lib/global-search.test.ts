import { describe, expect, it } from 'vitest'
import {
  normalizeSearchQuery,
  normalizeSearchSource,
} from '@/lib/global-search'
import { globalLibraryBookWhere } from '@/lib/library-search'

describe('global search', () => {
  it('limits anonymous visitors to Kyobo', () => {
    expect(normalizeSearchSource('all', false)).toBe('kyobo')
    expect(normalizeSearchSource('library', false)).toBe('kyobo')
    expect(normalizeSearchSource('kyobo', false)).toBe('kyobo')
  })

  it('accepts known sources for signed-in users and defaults to all', () => {
    expect(normalizeSearchSource('library', true)).toBe('library')
    expect(normalizeSearchSource('kyobo', true)).toBe('kyobo')
    expect(normalizeSearchSource('unexpected', true)).toBe('all')
  })

  it('trims and bounds search input', () => {
    expect(normalizeSearchQuery('  Dune  ')).toBe('Dune')
    expect(normalizeSearchQuery('x'.repeat(140))).toHaveLength(120)
  })

  it('constrains library matches to owned or shared libraries', () => {
    const where = globalLibraryBookWhere('user-1', 'Dune')
    expect(where.library).toEqual({
      is: {
        OR: [
          { ownerId: 'user-1' },
          { members: { some: { userId: 'user-1' } } },
        ],
      },
    })
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { title: { contains: 'Dune', mode: 'insensitive' } },
        { authors: { has: 'Dune' } },
        { isbn13: { contains: 'Dune' } },
      ]),
    )
  })
})
