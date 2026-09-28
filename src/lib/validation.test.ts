import { describe, expect, it } from 'vitest'
import {
  kyoboBookUrlSchema,
  kyoboGenreUrlSchema,
  normalizeIsbn,
  normalizeLoginId,
} from '@/lib/validation'

describe('validation', () => {
  it('normalizes login IDs and ISBNs', () => {
    expect(normalizeLoginId(' Reader.One ')).toBe('reader.one')
    expect(normalizeIsbn('979-11-5710-722-3')).toBe('9791157107223')
  })

  it('accepts only canonical Kyobo URLs', () => {
    expect(
      kyoboBookUrlSchema.parse(
        'https://product.kyobobook.co.kr/detail/S000001750574',
      ),
    ).toContain('S000001750574')
    expect(
      kyoboGenreUrlSchema.parse(
        'https://store.kyobobook.co.kr/category/domestic/010517',
      ),
    ).toContain('/category/')
    expect(() =>
      kyoboBookUrlSchema.parse('https://example.com/detail/S000001750574'),
    ).toThrow()
    expect(() =>
      kyoboGenreUrlSchema.parse(
        'http://store.kyobobook.co.kr/category/domestic',
      ),
    ).toThrow()
  })
})
