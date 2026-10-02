import { chromium } from 'playwright'
import { load } from 'cheerio'
import {
  isAllowedKyoboCoverUrl,
  isKyoboSaleId,
  kyoboProductUrl,
} from '@/lib/kyobo-preview'
import { normalizeIsbn } from '@/lib/validation'

const SEARCH_URL =
  'https://search.kyobobook.co.kr/srp/api/v1/search/autocomplete/shop'
const MAX_SEARCH_BYTES = 2_000_000
const TEST_FIXTURE_QUERY = 'progressive kyobo fixture'

function testFixtureEnabled() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.KYOBO_TEST_FIXTURE === '1'
  )
}

function fixtureCandidate(): BookCandidate {
  return {
    saleId: 'S000009999999',
    title: 'Progressive Kyobo Test Book',
    authors: ['Fixture Author'],
    isbn: '9791158887544',
    sourceUrl: kyoboProductUrl('S000009999999'),
    format: 'PHYSICAL',
    category: 'Fixture Category',
    publisher: 'Fixture Publisher',
    publicationYear: 2026,
    publicationMonth: 9,
    listPrice: 20_000,
    salePrice: 18_000,
    discountPercent: 10,
    rewardPoints: 900,
    rating: 4.8,
    categoryCode: '010101',
    description: 'Deterministic canonical details loaded after the preview.',
  }
}

export type GenreNode = { name: string; url: string }
export type GenrePath = GenreNode[]

export type BookCandidate = {
  saleId: string
  title: string
  authors: string[]
  isbn: string
  sourceUrl: string
  format: 'PHYSICAL' | 'EBOOK'
  coverUrl?: string
  description?: string
  category?: string
  publisher?: string
  publicationYear?: number
  publicationMonth?: number
  listPrice?: number
  salePrice?: number
  discountPercent?: number
  rewardPoints?: number
  rating?: number
  categoryCode?: string
}

export type KyoboBook = Omit<BookCandidate, 'coverUrl' | 'description'> & {
  authors: string[]
  description: string
  coverUrl: string | null
  genrePaths: GenrePath[]
}

type SearchDocument = {
  CMDTCODE?: unknown
  CMDT_NAME?: unknown
  SALE_CMDTID?: unknown
  SALE_CMDT_DVSN_CODE_SUB?: unknown
  TOT_RELATE_HTML_LIST?: unknown
}

const detailCache = new Map<string, { expiresAt: number; value: KyoboBook }>()

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximum ? normalized : undefined
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== 'string' || !/^\d+(?:\.0+)?$/.test(value))
    return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : undefined
}

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))
    return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : undefined
}

function mapDocument(input: unknown): BookCandidate | null {
  if (!input || typeof input !== 'object') return null
  const document = input as SearchDocument
  const title = boundedText(document.CMDT_NAME, 240)
  const isbn = normalizeIsbn(
    typeof document.CMDTCODE === 'string' ? document.CMDTCODE : '',
  )
  const saleId =
    typeof document.SALE_CMDTID === 'string' ? document.SALE_CMDTID : undefined
  if (!title || !/^(?:\d{10}|\d{13})$/.test(isbn) || !isKyoboSaleId(saleId))
    return null
  const fields =
    typeof document.TOT_RELATE_HTML_LIST === 'string'
      ? document.TOT_RELATE_HTML_LIST.split('$@')
      : []
  const author = boundedText(fields[3], 240)
  const publicationYear = boundedInteger(
    fields[5],
    1000,
    new Date().getFullYear() + 2,
  )
  return {
    saleId,
    title,
    authors: author ? [author] : [],
    isbn,
    sourceUrl: kyoboProductUrl(saleId),
    format: saleId.startsWith('E') ? 'EBOOK' : 'PHYSICAL',
    coverUrl: isAllowedKyoboCoverUrl(fields[14]) ? fields[14] : undefined,
    description: boundedText(fields[21], 4_000),
    category: boundedText(fields[1], 120),
    publisher: boundedText(fields[4], 120),
    publicationYear,
    publicationMonth: publicationYear
      ? boundedInteger(fields[6], 1, 12)
      : undefined,
    listPrice: boundedInteger(fields[7], 0, 100_000_000),
    salePrice: boundedInteger(fields[8], 0, 100_000_000),
    discountPercent: boundedNumber(fields[9], 0, 100),
    rewardPoints: boundedInteger(fields[10], 0, 100_000_000),
    rating: boundedNumber(fields[20], 0, 5),
    categoryCode: /^\d{1,12}$/.test(fields[26] ?? '') ? fields[26] : undefined,
  }
}

export function parseSearchResponse(body: string, keyword: string) {
  const payload = JSON.parse(body) as {
    resultCode?: string
    data?: { returnCode?: number; resultDocuments?: unknown[] }
  }
  if (
    payload.resultCode !== '200' ||
    payload.data?.returnCode !== 1 ||
    !Array.isArray(payload.data.resultDocuments)
  ) {
    throw new Error('Kyobo returned an invalid search response')
  }
  const mapped = payload.data.resultDocuments
    .map(mapDocument)
    .filter((item): item is BookCandidate => Boolean(item))
  const uniqueCandidates = new Map<string, BookCandidate>()
  mapped.forEach((candidate) => {
    if (!uniqueCandidates.has(candidate.saleId))
      uniqueCandidates.set(candidate.saleId, candidate)
  })
  const candidates = Array.from(uniqueCandidates.values())
  const normalizedKeyword = normalizeIsbn(keyword)
  return /^(?:\d{10}|\d{13})$/.test(normalizedKeyword)
    ? candidates.filter((candidate) => candidate.isbn === normalizedKeyword)
    : candidates
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
    sourceUrl: kyoboProductUrl(saleId),
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
  if (testFixtureEnabled() && normalized === TEST_FIXTURE_QUERY)
    return [fixtureCandidate()]
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
  if (!isKyoboSaleId(saleId)) throw new Error('Invalid Kyobo product ID')
  if (testFixtureEnabled() && saleId === 'S000009999999') {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    return {
      ...fixtureCandidate(),
      authors: ['Fixture Author', 'Verified Contributor'],
      description: 'Deterministic canonical details loaded after the preview.',
      coverUrl: null,
      genrePaths: [
        [
          {
            name: 'Fixture Genre',
            url: 'https://store.kyobobook.co.kr/category/domestic/01',
          },
        ],
      ],
    }
  }
  const cached = detailCache.get(saleId)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ locale: 'ko-KR' })
    const sourceUrl = kyoboProductUrl(saleId)
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
