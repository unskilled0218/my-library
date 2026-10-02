import { describe, expect, it } from 'vitest'
import {
  buildKyoboDetailHref,
  isAllowedKyoboCoverUrl,
  isKyoboSaleId,
  parseKyoboPreview,
} from '@/lib/kyobo-preview'

describe('Kyobo preview URLs', () => {
  it('round trips bounded Korean metadata and repeated authors', () => {
    const href = buildKyoboDetailHref(
      {
        saleId: 'S000001772370',
        title: '모래 행성',
        authors: ['프랭크 허버트', '김 번역'],
        isbn: '979-11-5888-754-4',
        format: 'PHYSICAL',
        coverUrl: 'https://contents.kyobobook.co.kr/example.jpg',
      },
      { q: '모래', source: 'all', libraryId: 'library-1' },
    )
    const url = new URL(href, 'https://example.test')

    expect(url.pathname).toBe('/search/kyobo/S000001772370')
    expect(url.searchParams.getAll('author')).toEqual([
      '프랭크 허버트',
      '김 번역',
    ])
    expect(parseKyoboPreview(url.searchParams)).toEqual({
      title: '모래 행성',
      authors: ['프랭크 허버트', '김 번역'],
      isbn: '9791158887544',
      format: 'PHYSICAL',
      coverUrl: 'https://contents.kyobobook.co.kr/example.jpg',
    })
  })

  it('rejects incomplete and oversized snapshots', () => {
    expect(parseKyoboPreview(new URLSearchParams())).toBeNull()
    expect(
      parseKyoboPreview({
        title: 'x'.repeat(241),
        isbn: '9791158887544',
        format: 'PHYSICAL',
      }),
    ).toBeNull()
    expect(
      parseKyoboPreview({
        title: 'Dune',
        isbn: 'not-an-isbn',
        format: 'PHYSICAL',
      }),
    ).toBeNull()
    for (const isbn of ['12345678901', '123456789012']) {
      expect(
        parseKyoboPreview({ title: 'Dune', isbn, format: 'PHYSICAL' }),
      ).toBeNull()
    }
  })

  it('bounds authors and drops invalid cover URLs', () => {
    const preview = parseKyoboPreview({
      title: 'Dune',
      author: Array.from({ length: 10 }, (_, index) => `Author ${index}`),
      isbn: '9791158887544',
      format: 'EBOOK',
      cover: 'https://evil.example/cover.jpg',
    })

    expect(preview?.authors).toHaveLength(8)
    expect(preview?.coverUrl).toBeNull()
    expect(isAllowedKyoboCoverUrl('http://contents.kyobobook.co.kr/a')).toBe(
      false,
    )
    expect(
      isAllowedKyoboCoverUrl('https://contents.kyobobook.co.kr.evil.example/a'),
    ).toBe(false)
  })

  it('accepts only bounded canonical sale IDs', () => {
    expect(isKyoboSaleId('S000001772370')).toBe(true)
    expect(isKyoboSaleId('s000001772370')).toBe(false)
    expect(isKyoboSaleId('S1/path')).toBe(false)
    expect(isKyoboSaleId(`S${'1'.repeat(21)}`)).toBe(false)
  })
})
