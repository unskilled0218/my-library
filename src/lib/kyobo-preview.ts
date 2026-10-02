import type { SearchSource } from '@/lib/global-search'
import { normalizeIsbn } from '@/lib/validation'

const MAX_SALE_ID_DIGITS = 20
const MAX_TITLE_LENGTH = 240
const MAX_AUTHORS = 8
const MAX_AUTHOR_LENGTH = 120
const MAX_COVER_URL_LENGTH = 500
const MAX_DESCRIPTION_LENGTH = 300
export const MAX_KYOBO_PREVIEW_QUERY_LENGTH = 4_000

type ParameterSource =
  URLSearchParams | FormData | Record<string, string | string[] | undefined>

export type KyoboPreview = {
  title: string
  authors: string[]
  isbn: string
  format: 'PHYSICAL' | 'EBOOK'
  coverUrl: string | null
  category?: string | null
  publisher?: string | null
  publicationYear?: number | null
  publicationMonth?: number | null
  listPrice?: number | null
  salePrice?: number | null
  discountPercent?: number | null
  rewardPoints?: number | null
  rating?: number | null
  categoryCode?: string | null
  description?: string | null
  descriptionTruncated?: boolean
}

export type KyoboSearchContext = {
  q: string
  source: SearchSource
  libraryId?: string
}

function parameterValues(source: ParameterSource, key: string) {
  const getAllSource = source as URLSearchParams | FormData
  if (typeof getAllSource.getAll === 'function') {
    return getAllSource
      .getAll(key)
      .filter((value): value is string => typeof value === 'string')
  }
  const value = (source as Record<string, string | string[] | undefined>)[key]
  return Array.isArray(value) ? value : value === undefined ? [] : [value]
}

function boundedValue(source: ParameterSource, key: string, maximum: number) {
  const value = parameterValues(source, key)[0]?.trim()
  return value && value.length <= maximum ? value : null
}

function boundedNumber(
  source: ParameterSource,
  key: string,
  minimum: number,
  maximum: number,
  integer = false,
) {
  const value = boundedValue(source, key, 20)
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return null
  const parsed = Number(value)
  if (
    !Number.isFinite(parsed) ||
    parsed < minimum ||
    parsed > maximum ||
    (integer && !Number.isSafeInteger(parsed))
  )
    return null
  return parsed
}

export function isKyoboSaleId(value: string | undefined): value is string {
  return Boolean(
    value && new RegExp(`^[A-Z]\\d{1,${MAX_SALE_ID_DIGITS}}$`).test(value),
  )
}

export function kyoboProductUrl(saleId: string) {
  if (!isKyoboSaleId(saleId)) throw new Error('Invalid Kyobo product ID')
  return `https://product.kyobobook.co.kr/detail/${saleId}`
}

export function isAllowedKyoboCoverUrl(value: string | undefined | null) {
  if (!value || value.length > MAX_COVER_URL_LENGTH) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' && url.hostname === 'contents.kyobobook.co.kr'
    )
  } catch {
    return false
  }
}

export function parseKyoboPreview(
  source: ParameterSource,
): KyoboPreview | null {
  const title = boundedValue(source, 'title', MAX_TITLE_LENGTH)
  const isbnValue = boundedValue(source, 'isbn', 20)
  const formatValue = boundedValue(source, 'format', 16)
  if (!title || !isbnValue) return null

  const isbn = normalizeIsbn(isbnValue)
  if (!/^(?:\d{10}|\d{13})$/.test(isbn)) return null
  if (formatValue !== 'PHYSICAL' && formatValue !== 'EBOOK') return null

  const authors = parameterValues(source, 'author')
    .slice(0, MAX_AUTHORS)
    .map((author) => author.trim())
    .filter((author) => author && author.length <= MAX_AUTHOR_LENGTH)
  const coverValue = boundedValue(source, 'cover', MAX_COVER_URL_LENGTH)
  const publicationYear = boundedNumber(
    source,
    'year',
    1000,
    new Date().getFullYear() + 2,
    true,
  )
  const publicationMonth = publicationYear
    ? boundedNumber(source, 'month', 1, 12, true)
    : null

  return {
    title,
    authors,
    isbn,
    format: formatValue,
    coverUrl: isAllowedKyoboCoverUrl(coverValue) ? coverValue : null,
    category: boundedValue(source, 'category', 120),
    publisher: boundedValue(source, 'publisher', 120),
    publicationYear,
    publicationMonth,
    listPrice: boundedNumber(source, 'listPrice', 0, 100_000_000, true),
    salePrice: boundedNumber(source, 'salePrice', 0, 100_000_000, true),
    discountPercent: boundedNumber(source, 'discount', 0, 100),
    rewardPoints: boundedNumber(source, 'reward', 0, 100_000_000, true),
    rating: boundedNumber(source, 'rating', 0, 5),
    categoryCode:
      boundedValue(source, 'categoryCode', 12)?.match(/^\d+$/)?.[0] ?? null,
    description: boundedValue(source, 'description', MAX_DESCRIPTION_LENGTH),
    descriptionTruncated:
      boundedValue(source, 'descriptionTruncated', 1) === '1' &&
      Boolean(boundedValue(source, 'description', MAX_DESCRIPTION_LENGTH)),
  }
}

export function appendKyoboPreview(
  params: URLSearchParams,
  preview: {
    title: string
    authors: string[]
    isbn: string
    format: 'PHYSICAL' | 'EBOOK'
    coverUrl?: string | null
    category?: string | null
    publisher?: string | null
    publicationYear?: number | null
    publicationMonth?: number | null
    listPrice?: number | null
    salePrice?: number | null
    discountPercent?: number | null
    rewardPoints?: number | null
    rating?: number | null
    categoryCode?: string | null
    description?: string | null
    descriptionTruncated?: boolean
  },
) {
  const normalized = parseKyoboPreview({
    title: preview.title,
    author: preview.authors,
    isbn: preview.isbn,
    format: preview.format,
    cover: preview.coverUrl ?? undefined,
    category: preview.category ?? undefined,
    publisher: preview.publisher ?? undefined,
    year: preview.publicationYear?.toString(),
    month: preview.publicationMonth?.toString(),
    listPrice: preview.listPrice?.toString(),
    salePrice: preview.salePrice?.toString(),
    discount: preview.discountPercent?.toString(),
    reward: preview.rewardPoints?.toString(),
    rating: preview.rating?.toString(),
    categoryCode: preview.categoryCode ?? undefined,
    description: preview.description?.slice(0, MAX_DESCRIPTION_LENGTH),
    descriptionTruncated:
      preview.descriptionTruncated ||
      (preview.description &&
        preview.description.length > MAX_DESCRIPTION_LENGTH)
        ? '1'
        : undefined,
  })
  if (!normalized) return params

  params.set('title', normalized.title)
  params.delete('author')
  normalized.authors.forEach((author) => params.append('author', author))
  params.set('isbn', normalized.isbn)
  params.set('format', normalized.format)
  if (normalized.coverUrl) params.set('cover', normalized.coverUrl)
  const optionalValues: Array<[string, string | number | null | undefined]> = [
    ['category', normalized.category],
    ['publisher', normalized.publisher],
    ['year', normalized.publicationYear],
    ['month', normalized.publicationMonth],
    ['listPrice', normalized.listPrice],
    ['salePrice', normalized.salePrice],
    ['discount', normalized.discountPercent],
    ['reward', normalized.rewardPoints],
    ['rating', normalized.rating],
    ['categoryCode', normalized.categoryCode],
    ['description', normalized.description],
    ['descriptionTruncated', normalized.descriptionTruncated ? '1' : null],
  ]
  optionalValues.forEach(([key, value]) => {
    if (value != null) params.set(key, String(value))
  })
  for (const key of [
    'description',
    'rating',
    'reward',
    'discount',
    'listPrice',
    'salePrice',
    'categoryCode',
    'month',
    'year',
    'publisher',
    'category',
    'cover',
  ]) {
    if (params.toString().length <= MAX_KYOBO_PREVIEW_QUERY_LENGTH) break
    params.delete(key)
    if (key === 'description') params.delete('descriptionTruncated')
  }
  while (
    params.toString().length > MAX_KYOBO_PREVIEW_QUERY_LENGTH &&
    params.getAll('author').length > 0
  ) {
    const authors = params.getAll('author')
    params.delete('author')
    authors.slice(0, -1).forEach((author) => params.append('author', author))
  }
  return params
}

export function appendSearchContext(
  params: URLSearchParams,
  context: KyoboSearchContext,
) {
  params.set('q', context.q)
  params.set('source', context.source)
  if (context.libraryId) params.set('libraryId', context.libraryId)
  return params
}

export function buildKyoboDetailHref(
  candidate: {
    saleId: string
    title: string
    authors: string[]
    isbn: string
    format: 'PHYSICAL' | 'EBOOK'
    coverUrl?: string | null
    category?: string | null
    publisher?: string | null
    publicationYear?: number | null
    publicationMonth?: number | null
    listPrice?: number | null
    salePrice?: number | null
    discountPercent?: number | null
    rewardPoints?: number | null
    rating?: number | null
    categoryCode?: string | null
    description?: string | null
  },
  context: KyoboSearchContext,
) {
  const params = appendKyoboPreview(
    appendSearchContext(new URLSearchParams(), context),
    candidate,
  )
  return `/search/kyobo/${candidate.saleId}?${params}`
}

export function buildSearchHref(context: KyoboSearchContext) {
  return `/search?${appendSearchContext(new URLSearchParams(), context)}`
}

export function kyoboPreviewEntries(preview: KyoboPreview) {
  return [
    ['title', preview.title],
    ...preview.authors.map((author) => ['author', author]),
    ['isbn', preview.isbn],
    ['format', preview.format],
    ...(preview.coverUrl ? [['cover', preview.coverUrl]] : []),
    ...(preview.category ? [['category', preview.category]] : []),
    ...(preview.publisher ? [['publisher', preview.publisher]] : []),
    ...(preview.publicationYear
      ? [['year', String(preview.publicationYear)]]
      : []),
    ...(preview.publicationMonth
      ? [['month', String(preview.publicationMonth)]]
      : []),
    ...(preview.listPrice != null
      ? [['listPrice', String(preview.listPrice)]]
      : []),
    ...(preview.salePrice != null
      ? [['salePrice', String(preview.salePrice)]]
      : []),
    ...(preview.discountPercent != null
      ? [['discount', String(preview.discountPercent)]]
      : []),
    ...(preview.rewardPoints != null
      ? [['reward', String(preview.rewardPoints)]]
      : []),
    ...(preview.rating != null ? [['rating', String(preview.rating)]] : []),
    ...(preview.categoryCode ? [['categoryCode', preview.categoryCode]] : []),
    ...(preview.description ? [['description', preview.description]] : []),
    ...(preview.descriptionTruncated ? [['descriptionTruncated', '1']] : []),
  ] as Array<[string, string]>
}
