import { chromium } from 'playwright'
import { load } from 'cheerio'
import {
  isAllowedKyoboCoverUrl,
  isKyoboSaleId,
  kyoboProductUrl,
} from '@/lib/kyobo-preview'
import { isbnIdentity, isSameIsbn } from '@/lib/isbn'
import {
  cleanCodeSearchHtml,
  emptyAutocompleteResponse,
  KYOBO_SEARCH_FIXTURE_ISBN,
} from '@/lib/kyobo-search-fixtures'

const SEARCH_URL =
  'https://search.kyobobook.co.kr/srp/api/v1/search/autocomplete/shop'
const MAX_SEARCH_BYTES = 2_000_000
const TEST_FIXTURE_QUERY = 'progressive kyobo fixture'
const failedFixtureProducts = new Set<string>()

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
  const isbn = isbnIdentity(
    typeof document.CMDTCODE === 'string' ? document.CMDTCODE : '',
  )
  const saleId =
    typeof document.SALE_CMDTID === 'string' ? document.SALE_CMDTID : undefined
  if (!title || !isbn || !isKyoboSaleId(saleId)) return null
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

function autocompleteResults(body: string, keyword: string) {
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
  const results = matchingCandidates(mapped, keyword)
  return {
    results,
    documentCount: payload.data.resultDocuments.length,
    acceptedCount: mapped.length,
    rejectedCount: payload.data.resultDocuments.length - mapped.length,
    matchingCount: results.length,
  }
}

export function parseSearchResponse(body: string, keyword: string) {
  return autocompleteResults(body, keyword).results
}

function matchingCandidates(candidates: BookCandidate[], keyword: string) {
  const byId = new Map<string, BookCandidate>()
  for (const candidate of candidates) {
    if (!byId.has(candidate.saleId)) byId.set(candidate.saleId, candidate)
  }
  const unique = [...byId.values()]
  return isbnIdentity(keyword)
    ? unique.filter((candidate) => isSameIsbn(candidate.isbn, keyword))
    : unique
}

function websiteResults(body: string, keyword: string) {
  const $ = load(body)
  const root = $('#result_contents')
  const count = root.attr('data-total-count')
  if (root.length !== 1 || !count || !/^\d+$/.test(count))
    throw new Error('Kyobo returned an unrecognized full-search page')
  const cards = root.find('#shopData_list .prod_list > .prod_item')
  const candidates: BookCandidate[] = []
  cards.each((_, element) => {
    const card = $(element)
    const identity = card.find('input[data-pid][data-bid][data-name]').first()
    const saleId = identity.attr('data-pid')
    const isbn = isbnIdentity(identity.attr('data-bid') ?? '')
    const title = boundedText(identity.attr('data-name'), 240)
    if (!isKyoboSaleId(saleId) || !isbn || !title) return
    const href = card.find('a.prod_info').first().attr('href')
    if (
      href !== kyoboProductUrl(saleId) &&
      href !== `https://ebook-product.kyobobook.co.kr/dig/epd/ebook/${saleId}`
    )
      return
    const cover = card.find('img').first().attr('src')
    candidates.push({
      saleId,
      isbn,
      title,
      sourceUrl: kyoboProductUrl(saleId),
      format: saleId.startsWith('E') ? 'EBOOK' : 'PHYSICAL',
      authors: card
        .find('a.author')
        .map((__, author) => boundedText($(author).text(), 240))
        .get()
        .filter((author): author is string => Boolean(author)),
      publisher: boundedText(
        card.find('.prod_publish a.text').first().text(),
        120,
      ),
      coverUrl: isAllowedKyoboCoverUrl(cover) ? cover : undefined,
    })
  })
  const results = matchingCandidates(candidates, keyword)
  const rejectedCount = cards.length - candidates.length
  if (
    (Number(count) > 0 && !cards.length) ||
    (rejectedCount > 0 && !results.length) ||
    (Number(count) === 0 && cards.length > 0)
  ) {
    throw new Error(
      'Kyobo full-search product identities could not be verified',
    )
  }
  return {
    results,
    documentCount: cards.length,
    acceptedCount: candidates.length,
    rejectedCount,
    matchingCount: results.length,
  }
}

export function parseWebsiteSearchResponse(body: string, keyword: string) {
  return websiteResults(body, keyword).results
}

export type KyoboSearchStage = {
  source: 'autocomplete' | 'website'
  url: string
  documentCount?: number
  acceptedCount?: number
  rejectedCount?: number
  matchingCount?: number
  error?: string
}

export type KyoboSearchReport = {
  keyword: string
  normalizedKeyword: string
  websiteUrl: string
  stages: KyoboSearchStage[]
  results: BookCandidate[]
  error?: string
}

function websiteSearchUrl(keyword: string) {
  const url = new URL('https://search.kyobobook.co.kr/search')
  url.search = new URLSearchParams({
    keyword,
    gbCode: 'TOT',
    target: 'total',
  }).toString()
  return url
}

async function searchResponseText(
  url: URL,
  source: KyoboSearchStage['source'],
) {
  if (
    testFixtureEnabled() &&
    url.searchParams.get('keyword') === KYOBO_SEARCH_FIXTURE_ISBN
  ) {
    return source === 'autocomplete'
      ? emptyAutocompleteResponse
      : cleanCodeSearchHtml
  }
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: source === 'autocomplete' ? 'application/json' : 'text/html',
    },
  })
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw new Error(`Kyobo ${source} search failed (${response.status})`)
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error(`Kyobo ${source} search returned an empty body`)
  const decoder = new TextDecoder()
  let bytes = 0
  let body = ''
  try {
    if (Number(response.headers.get('content-length')) > MAX_SEARCH_BYTES)
      throw new Error('Kyobo search response is too large')
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_SEARCH_BYTES)
        throw new Error('Kyobo search response is too large')
      body += decoder.decode(chunk.value, { stream: true })
    }
    return body + decoder.decode()
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function probeKyoboSearch(
  keyword: string,
): Promise<KyoboSearchReport> {
  const trimmed = keyword.trim()
  if (!trimmed || trimmed.length > 120)
    throw new Error('Enter a search keyword')
  const isbn = isbnIdentity(trimmed)
  const normalized = isbn ?? trimmed
  const website = websiteSearchUrl(normalized)
  const report: KyoboSearchReport = {
    keyword,
    normalizedKeyword: normalized,
    websiteUrl: website.toString(),
    stages: [],
    results: [],
  }
  const autocomplete = new URL(SEARCH_URL)
  autocomplete.searchParams.set('keyword', normalized)
  const sources = isbn
    ? (['autocomplete', 'website'] as const)
    : (['autocomplete'] as const)
  for (const source of sources) {
    const url = source === 'autocomplete' ? autocomplete : website
    try {
      const body = await searchResponseText(url, source)
      const parsed =
        source === 'autocomplete'
          ? autocompleteResults(body, normalized)
          : websiteResults(body, normalized)
      const { results, ...counts } = parsed
      report.stages.push({ source, url: url.toString(), ...counts })
      if (results.length || source === 'website' || !isbn) {
        if (!results.length && counts.rejectedCount > 0)
          throw new Error(
            'Kyobo search product identities could not be verified',
          )
        report.results = results
        return report
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? [
              error.message,
              error.cause instanceof Error ? error.cause.message : undefined,
            ]
              .filter(Boolean)
              .join(': ')
          : String(error)
      const stage = report.stages.at(-1)
      if (stage?.source === source) stage.error = message
      else report.stages.push({ source, url: url.toString(), error: message })
    }
  }
  report.error = `Kyobo search failed: ${report.stages
    .filter((stage) => stage.error)
    .map((stage) => `${stage.source}: ${stage.error}`)
    .join('; ')}`
  return report
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
  const deferredFixture = normalized.match(
    /^deferred kyobo fixture (\d{1,16})$/,
  )
  if (testFixtureEnabled() && deferredFixture) {
    const saleId = `S888${deferredFixture[1]}`
    return [
      {
        ...fixtureCandidate(),
        saleId,
        title: 'Deferred Kyobo Test Book',
        sourceUrl: kyoboProductUrl(saleId),
      },
    ]
  }
  const report = await probeKyoboSearch(keyword)
  if (report.error) throw new Error(report.error)
  return report.results
}

export async function getKyoboBook(saleId: string): Promise<KyoboBook> {
  if (!isKyoboSaleId(saleId)) throw new Error('Invalid Kyobo product ID')
  const deferredFixture = /^S888\d{1,16}$/.test(saleId)
  if (testFixtureEnabled() && (saleId === 'S000009999999' || deferredFixture)) {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    if (deferredFixture && !failedFixtureProducts.has(saleId)) {
      failedFixtureProducts.add(saleId)
      throw new Error('Deterministic first add attempt failed')
    }
    return {
      ...fixtureCandidate(),
      saleId,
      sourceUrl: kyoboProductUrl(saleId),
      title: deferredFixture
        ? 'Deferred Kyobo Test Book'
        : 'Progressive Kyobo Test Book',
      authors: ['Fixture Author', 'Verified Contributor'],
      description: 'Deterministic canonical details loaded after the preview.',
      coverUrl: null,
      genrePaths: [
        [
          {
            name: 'Fixture Genre',
            url: 'https://store.kyobobook.co.kr/category/fixture-kyobo',
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
