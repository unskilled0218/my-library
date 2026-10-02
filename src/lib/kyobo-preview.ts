import type { SearchSource } from '@/lib/global-search'
import { normalizeIsbn } from '@/lib/validation'

const MAX_SALE_ID_DIGITS = 20
const MAX_TITLE_LENGTH = 240
const MAX_AUTHORS = 8
const MAX_AUTHOR_LENGTH = 120
const MAX_COVER_URL_LENGTH = 500

type ParameterSource =
  URLSearchParams | FormData | Record<string, string | string[] | undefined>

export type KyoboPreview = {
  title: string
  authors: string[]
  isbn: string
  format: 'PHYSICAL' | 'EBOOK'
  coverUrl: string | null
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

  return {
    title,
    authors,
    isbn,
    format: formatValue,
    coverUrl: isAllowedKyoboCoverUrl(coverValue) ? coverValue : null,
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
  },
) {
  const normalized = parseKyoboPreview({
    title: preview.title,
    author: preview.authors,
    isbn: preview.isbn,
    format: preview.format,
    cover: preview.coverUrl ?? undefined,
  })
  if (!normalized) return params

  params.set('title', normalized.title)
  params.delete('author')
  normalized.authors.forEach((author) => params.append('author', author))
  params.set('isbn', normalized.isbn)
  params.set('format', normalized.format)
  if (normalized.coverUrl) params.set('cover', normalized.coverUrl)
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
  ] as Array<[string, string]>
}
