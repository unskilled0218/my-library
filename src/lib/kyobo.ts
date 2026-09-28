import { chromium } from 'playwright'
import { load } from 'cheerio'
import { normalizeIsbn } from '@/lib/validation'

const SEARCH_URL =
  'https://search.kyobobook.co.kr/srp/api/v1/search/autocomplete/shop'
const PRODUCT_ORIGIN = 'https://product.kyobobook.co.kr'
const MAX_SEARCH_BYTES = 2_000_000

export type GenreNode = { name: string; url: string }
export type GenrePath = GenreNode[]

export type BookCandidate = {
  saleId: string
  title: string
  isbn: string
  sourceUrl: string
  format: 'PHYSICAL' | 'EBOOK'
  coverUrl?: string
  description?: string
}

export type KyoboBook = Omit<BookCandidate, 'coverUrl' | 'description'> & {
  authors: string[]
  description: string
  coverUrl: string | null
  genrePaths: GenrePath[]
}

type SearchDocument = {
  CMDTCODE?: string
  CMDT_NAME?: string
  SALE_CMDTID?: string
  SALE_CMDT_DVSN_CODE_SUB?: string
  TOT_RELATE_HTML_LIST?: string
}

const detailCache = new Map<string, { expiresAt: number; value: KyoboBook }>()

function mapDocument(document: SearchDocument): BookCandidate | null {
  if (
    !document.CMDTCODE ||
    !document.CMDT_NAME ||
    !document.SALE_CMDTID ||
    !/^[A-Z]\d+$/.test(document.SALE_CMDTID)
  )
    return null
  const fields = document.TOT_RELATE_HTML_LIST?.split('$@') ?? []
  return {
    saleId: document.SALE_CMDTID,
    title: document.CMDT_NAME.trim(),
    isbn: normalizeIsbn(document.CMDTCODE),
    sourceUrl: `${PRODUCT_ORIGIN}/detail/${document.SALE_CMDTID}`,
    format: document.SALE_CMDT_DVSN_CODE_SUB === 'EBK' ? 'EBOOK' : 'PHYSICAL',
    coverUrl: fields.find((field) =>
      field.startsWith('https://contents.kyobobook.co.kr/'),
    ),
    description: fields.find((field) => field.length > 100),
  }
}

export function parseSearchResponse(body: string, keyword: string) {
  const payload = JSON.parse(body) as {
    resultCode?: string
    data?: { returnCode?: number; resultDocuments?: SearchDocument[] }
  }
  if (
    payload.resultCode !== '200' ||
    payload.data?.returnCode !== 1 ||
    !Array.isArray(payload.data.resultDocuments)
  ) {
    throw new Error('Kyobo returned an invalid search response')
  }
  const candidates = payload.data.resultDocuments
    .map(mapDocument)
    .filter((item): item is BookCandidate => Boolean(item))
  if (
    /^\d{10,13}$/.test(normalizeIsbn(keyword)) &&
    candidates[0]?.isbn !== normalizeIsbn(keyword)
  )
    return []
  return candidates
}

export function parseProductHtml(html: string, saleId: string): KyoboBook {
  const $ = load(html)
  const titleElement = $('h1[aria-label]').first()
  const title =
    titleElement.attr('aria-label')?.trim() ||
    titleElement.text().replace(/\s+/g, ' ').trim()
  const authors = $('a[href="#authorInfo"]')
    .map((_, element) => $(element).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean)
  const isbnRow = $('tr')
    .filter(
      (_, row) =>
        $(row).find('th').first().text().replace(/\s+/g, ' ').trim() === 'ISBN',
    )
    .first()
  const isbn = isbnRow.find('td').text().replace(/[-\s]/g, '')
  const description = $('#bookSimpleIntro').text().replace(/\s+/g, ' ').trim()
  const coverUrl = $('img[alt$="대표 이미지"]').first().attr('src') ?? null
  const genrePaths: GenrePath[] = []
  $('ul.flex.flex-col.justify-start > li > ul').each((_, row) => {
    const path = $(row)
      .find('a[href^="https://store.kyobobook.co.kr/category/"]')
      .map((__, link) => ({
        name: $(link).text().replace(/\s+/g, ' ').trim(),
        url: $(link).attr('href') ?? '',
      }))
      .get()
      .filter((node) => node.name && node.url)
    if (
      path.length > 1 &&
      !genrePaths.some(
        (existing) =>
          existing.map((node) => node.url).join('|') ===
          path.map((node) => node.url).join('|'),
      )
    )
      genrePaths.push(path)
  })
  if (!title || !isbn || authors.length === 0 || genrePaths.length === 0)
    throw new Error('Kyobo product page is missing required metadata')
  return {
    saleId,
    title,
    authors,
    isbn,
    sourceUrl: `${PRODUCT_ORIGIN}/detail/${saleId}`,
    description,
    coverUrl,
    genrePaths,
    format: saleId.startsWith('E') ? 'EBOOK' : 'PHYSICAL',
  }
}

export async function searchKyobo(keyword: string) {
  const normalized = keyword.trim()
  if (!normalized || normalized.length > 120)
    throw new Error('Enter a search keyword')
  const url = new URL(SEARCH_URL)
  url.searchParams.set('keyword', normalized)
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Kyobo search failed (${response.status})`)
  const body = await response.text()
  if (Buffer.byteLength(body) > MAX_SEARCH_BYTES)
    throw new Error('Kyobo search response is too large')
  return parseSearchResponse(body, normalized)
}

export async function getKyoboBook(saleId: string): Promise<KyoboBook> {
  if (!/^[A-Z]\d+$/.test(saleId)) throw new Error('Invalid Kyobo product ID')
  const cached = detailCache.get(saleId)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ locale: 'ko-KR' })
    const sourceUrl = `${PRODUCT_ORIGIN}/detail/${saleId}`
    const response = await page.goto(sourceUrl, {
      waitUntil: 'networkidle',
      timeout: 45_000,
    })
    if (!response?.ok())
      throw new Error(
        `Kyobo product page failed (${response?.status() ?? 'no response'})`,
      )

    const value = parseProductHtml(await page.content(), saleId)
    detailCache.set(saleId, { expiresAt: Date.now() + 5 * 60_000, value })
    return value
  } finally {
    await browser.close()
  }
}
