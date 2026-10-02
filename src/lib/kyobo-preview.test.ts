import { describe, expect, it } from 'vitest'
import {
  buildKyoboDetailHref,
  isAllowedKyoboCoverUrl,
  isKyoboSaleId,
  parseKyoboPreview,
  MAX_KYOBO_PREVIEW_QUERY_LENGTH,
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
        category: 'SF 소설',
        publisher: '테스트 출판사',
        publicationYear: 2026,
        publicationMonth: 9,
        listPrice: 20000,
        salePrice: 18000,
        discountPercent: 10,
        rewardPoints: 900,
        rating: 4.8,
        categoryCode: '010101',
        description: '검색에서 받은 책 소개',
      },
      { q: '모래', source: 'all', libraryId: 'library-1' },
    )
    const url = new URL(href, 'https://example.test')

    expect(url.pathname).toBe('/search/kyobo/S000001772370')
    expect(url.searchParams.getAll('author')).toEqual([
      '프랭크 허버트',
      '김 번역',
    ])
    expect(parseKyoboPreview(url.searchParams)).toMatchObject({
      title: '모래 행성',
      authors: ['프랭크 허버트', '김 번역'],
      isbn: '9791158887544',
      format: 'PHYSICAL',
      coverUrl: 'https://contents.kyobobook.co.kr/example.jpg',
      category: 'SF 소설',
      publisher: '테스트 출판사',
      publicationYear: 2026,
      publicationMonth: 9,
      listPrice: 20000,
      salePrice: 18000,
      discountPercent: 10,
      rewardPoints: 900,
      rating: 4.8,
      categoryCode: '010101',
      description: '검색에서 받은 책 소개',
    })
  })

  it('drops low-priority metadata to keep encoded preview URLs bounded', () => {
    const href = buildKyoboDetailHref(
      {
        saleId: 'S000001772370',
        title: '긴 제목'.repeat(30),
        authors: Array.from({ length: 8 }, () => '긴 저자 이름'.repeat(8)),
        isbn: '9791158887544',
        format: 'PHYSICAL',
        category: '소설',
        publisher: '출판사',
        description: '긴 책 소개'.repeat(100),
        listPrice: 20000,
        salePrice: 18000,
        rating: 5,
      },
      { q: '긴 검색어'.repeat(15), source: 'kyobo' },
    )
    const url = new URL(href, 'https://example.test')

    expect(url.search.slice(1).length).toBeLessThanOrEqual(
      MAX_KYOBO_PREVIEW_QUERY_LENGTH,
    )
    expect(url.searchParams.get('title')).toBeTruthy()
    expect(url.searchParams.get('isbn')).toBe('9791158887544')
    expect(url.searchParams.has('description')).toBe(false)
  })

  it('rejects malformed optional numeric metadata independently', () => {
    const preview = parseKyoboPreview({
      title: 'Dune',
      isbn: '9791158887544',
      format: 'PHYSICAL',
      year: '3000',
      month: '13',
      salePrice: '-1',
      discount: '101',
      rating: '6',
      categoryCode: '../bad',
    })

    expect(preview).toMatchObject({
      publicationYear: null,
      publicationMonth: null,
      salePrice: null,
      discountPercent: null,
      rating: null,
      categoryCode: null,
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
