import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseBookOptions } from '@/lib/book-options'

function form(values: Record<string, string | undefined>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) data.set(key, value)
  }
  return data
}
afterEach(() => vi.useRealTimers())

describe('add-book option parsing', () => {
  it('uses existing defaults when options are absent or blank', () => {
    const expected = {
      options: {
        ownershipState: 'HAVE',
        locationTagId: null,
        folderId: null,
        readingState: 'NOT_STARTED',
        readingStartedAt: null,
        readingFinishedAt: null,
        rating: null,
        comment: '',
      },
    }
    expect(parseBookOptions(form({}))).toEqual(expected)
    expect(
      parseBookOptions(
        form({ ownershipState: ' ', readingState: '', rating: '' }),
      ),
    ).toEqual(expected)
  })

  it('parses explicit choices and valid leap-day dates', () => {
    expect(
      parseBookOptions(
        form({
          ownershipState: 'DONT_HAVE',
          locationTagId: ' location ',
          folderId: 'folder',
          readingState: 'DONE',
          readingStartedAt: '2024-02-29',
          readingFinishedAt: '2024-03-01',
          rating: '5',
          comment: ' notes ',
        }),
      ),
    ).toEqual({
      options: {
        ownershipState: 'DONT_HAVE',
        locationTagId: 'location',
        folderId: 'folder',
        readingState: 'DONE',
        readingStartedAt: new Date('2024-02-29T00:00:00Z'),
        readingFinishedAt: new Date('2024-03-01T00:00:00Z'),
        rating: 5,
        comment: 'notes',
      },
    })
  })

  it.each([
    ['ownershipState', 'BORROWED', 'invalidOwnership'],
    ['readingState', 'UNKNOWN', 'invalidReadingState'],
    ['rating', '0', 'invalidRating'],
    ['rating', '6', 'invalidRating'],
    ['rating', '3.5', 'invalidRating'],
    ['rating', '4x', 'invalidRating'],
    ['readingStartedAt', '2025-02-29', 'invalidDate'],
    ['readingFinishedAt', '2026-04-31', 'invalidDate'],
    ['readingStartedAt', 'not-a-date', 'invalidDate'],
    ['readingStartedAt', '2026-1-01', 'invalidDate'],
    ['comment', 'x'.repeat(10_001), 'commentTooLong'],
  ])('rejects invalid %s input', (key, value, error) => {
    expect(parseBookOptions(form({ [key]: value }))).toEqual({ error })
  })

  it('accepts a comment at the exact limit', () => {
    const result = parseBookOptions(form({ comment: 'x'.repeat(10_000) }))
    expect('options' in result && result.options.comment.length).toBe(10_000)
  })

  it('rejects file values rather than treating them as text', () => {
    const data = form({})
    data.set('rating', new Blob(['5']), 'rating.txt')
    expect(parseBookOptions(data)).toEqual({ error: 'invalidRating' })
  })

  it('normalizes dates by reading state and uses one UTC calendar day for defaults', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T12:30:00Z'))
    const day = new Date('2026-10-16T00:00:00Z')
    expect(parseBookOptions(form({ readingState: 'DONE' }))).toMatchObject({
      options: { readingStartedAt: day, readingFinishedAt: day },
    })
    expect(
      parseBookOptions(
        form({ readingState: 'DONE', readingFinishedAt: '2026-10-16' }),
      ),
    ).toMatchObject({
      options: { readingStartedAt: day, readingFinishedAt: day },
    })
    expect(
      parseBookOptions(
        form({ readingState: 'READING', readingFinishedAt: '2026-10-17' }),
      ),
    ).toMatchObject({
      options: { readingStartedAt: day, readingFinishedAt: null },
    })
    expect(
      parseBookOptions(
        form({
          readingStartedAt: '2026-10-15',
          readingFinishedAt: '2026-10-16',
        }),
      ),
    ).toMatchObject({
      options: { readingStartedAt: null, readingFinishedAt: null },
    })
  })

  it.each([
    { readingStartedAt: '2026-10-17' },
    { readingFinishedAt: '2026-10-15' },
    { readingStartedAt: '2026-10-17', readingFinishedAt: '2026-10-16' },
  ])('rejects reversed dates even when one date defaults to today', (dates) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T12:30:00Z'))
    expect(parseBookOptions(form({ readingState: 'DONE', ...dates }))).toEqual({
      error: 'invalidDateOrder',
    })
  })
})
