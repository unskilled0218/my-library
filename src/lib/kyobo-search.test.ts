import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseSearchResponse,
  parseWebsiteSearchResponse,
  probeKyoboSearch,
  searchKyobo,
} from '@/lib/kyobo'
import {
  cleanCodeSearchHtml,
  emptyAutocompleteResponse,
} from '@/lib/kyobo-search-fixtures'

const isbn = '9780132350884'
const productId = 'S000006148336'
const emptyWebsite =
  '<div id="result_contents" data-total-count="0"><div class="no_data">No results</div></div>'
function autocomplete(
  documents: unknown[] = [
    { CMDTCODE: isbn, CMDT_NAME: 'Clean Code', SALE_CMDTID: productId },
  ],
) {
  return JSON.stringify({
    resultCode: '200',
    data: { returnCode: 1, resultDocuments: documents },
  })
}
function card(id: string, bookIsbn = isbn, title = 'Clean Code') {
  return `<li class="prod_item"><input data-pid="${id}" data-bid="${bookIsbn}" data-name="${title}"><a class="prod_info" href="https://product.kyobobook.co.kr/detail/${id}">${title}</a></li>`
}
function website(cards: string[], count = cards.length) {
  return `<div id="result_contents" data-total-count="${count}"><div id="shopData_list"><ul class="prod_list">${cards.join('')}</ul></div></div>`
}

describe('full website search parsing', () => {
  it('recovers the minimized live Clean Code result missed by autocomplete', () => {
    expect(parseSearchResponse(emptyAutocompleteResponse, isbn)).toEqual([])
    expect(parseWebsiteSearchResponse(cleanCodeSearchHtml, isbn)).toEqual([
      {
        saleId: productId,
        isbn,
        title: 'Clean Code',
        sourceUrl: `https://product.kyobobook.co.kr/detail/${productId}`,
        format: 'PHYSICAL',
        authors: [
          'Martin, Robert',
          'Feathers, Michael C.',
          'Ottinger, Timothy R.',
        ],
        publisher: 'Pearson',
        coverUrl: undefined,
      },
    ])
  })

  it('deduplicates sale IDs, keeps distinct matches, and ignores unrelated products and recommendations', () => {
    const body =
      website([
        card('S1'),
        card('S1', isbn, 'Duplicate'),
        card('S2'),
        card('S3', '9780201633610', 'Different book'),
      ]) + `<aside>${card('S4')}</aside>`
    const results = parseWebsiteSearchResponse(body, isbn)
    expect(results.map((book) => book.saleId)).toEqual(['S1', 'S2'])
    expect(results[0].title).toBe('Clean Code')
  })

  it('retains results without optional author, publisher, price, or cover data', () => {
    const [book] = parseWebsiteSearchResponse(website([card('S1')]), isbn)
    expect(book).toMatchObject({ saleId: 'S1', isbn, authors: [] })
    expect(book.publisher).toBeUndefined()
    expect(book.coverUrl).toBeUndefined()
  })

  it('drops invalid cover hosts without discarding the matching result', () => {
    const body = cleanCodeSearchHtml.replace(
      '</li>',
      '<img src="https://unrelated.example/cover.jpg"></li>',
    )
    expect(parseWebsiteSearchResponse(body, isbn)[0].coverUrl).toBeUndefined()
  })

  it('recognizes a valid empty result and excludes valid nonmatching identities', () => {
    expect(parseWebsiteSearchResponse(emptyWebsite, isbn)).toEqual([])
    expect(
      parseWebsiteSearchResponse(website([card('S1', '9780201633610')]), isbn),
    ).toEqual([])
  })

  it.each([
    '<html><h1>Access denied</h1></html>',
    '<script>challenge()</script>',
    '<div id="result_contents">Unexpected schema</div>',
    website([], 3),
    website([card('invalid')]),
    website([card('S1').replace(isbn, 'not-an-isbn')]),
    website([
      card('S1').replace(
        'https://product.kyobobook.co.kr/detail/S1',
        'https://unrelated.example/detail/S1',
      ),
    ]),
    website([card('S1')], 0),
  ])(
    'rejects malformed/challenge/identity responses instead of reporting no match',
    (body) => {
      expect(() => parseWebsiteSearchResponse(body, isbn)).toThrow('Kyobo')
    },
  )

  it('matches an ISBN-10 X identity to its equivalent ISBN-13 and preserves ebook format', () => {
    const body = website([card('E1', '097522980X')]).replace(
      'https://product.kyobobook.co.kr/detail/E1',
      'https://ebook-product.kyobobook.co.kr/dig/epd/ebook/E1',
    )
    expect(parseWebsiteSearchResponse(body, '9780975229804')).toMatchObject([
      { saleId: 'E1', isbn: '097522980X', format: 'EBOOK' },
    ])
  })
})

describe('bounded Kyobo request orchestration', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('KYOBO_TEST_FIXTURE', '0')
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('normalizes a formatted ISBN and uses one request when autocomplete matches', async () => {
    fetchMock.mockResolvedValue(new Response(autocomplete()))
    expect(await searchKyobo(' 978-0-13-235088-4 ')).toMatchObject([
      { saleId: productId, isbn },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.searchParams.get('keyword')).toBe(isbn)
    expect(options).toMatchObject({
      redirect: 'error',
      signal: expect.any(AbortSignal),
    })
  })

  it('uses canonical equivalence without an unnecessary fallback', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        autocomplete([
          { CMDTCODE: '9780975229804', CMDT_NAME: 'Book', SALE_CMDTID: 'S2' },
        ]),
      ),
    )
    expect(await searchKyobo('0-9752298-0-x')).toMatchObject([
      { saleId: 'S2', isbn: '9780975229804' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0].searchParams.get('keyword')).toBe(
      '097522980X',
    )
  })

  it.each([
    emptyAutocompleteResponse,
    autocomplete([null, { CMDT_NAME: 'Missing identity' }]),
    autocomplete([
      {
        CMDTCODE: '9780201633610',
        CMDT_NAME: 'Different book',
        SALE_CMDTID: 'S3',
      },
    ]),
    'not JSON',
  ])(
    'recovers an empty/rejected/nonmatching/malformed autocomplete response through full search',
    async (body) => {
      fetchMock
        .mockResolvedValueOnce(new Response(body))
        .mockResolvedValueOnce(new Response(cleanCodeSearchHtml))
      expect(await searchKyobo(isbn)).toMatchObject([
        { saleId: productId, isbn, title: 'Clean Code' },
      ])
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1][0].pathname).toBe('/search')
      expect(fetchMock.mock.calls[1][0].searchParams.get('keyword')).toBe(isbn)
    },
  )

  it('retains stage counts and the public website URL in comparison diagnostics', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(autocomplete([null])))
      .mockResolvedValueOnce(new Response(cleanCodeSearchHtml))
    const report = await probeKyoboSearch(isbn)
    expect(report.websiteUrl).toBe(
      `https://search.kyobobook.co.kr/search?keyword=${isbn}&gbCode=TOT&target=total`,
    )
    expect(report.stages).toMatchObject([
      {
        source: 'autocomplete',
        documentCount: 1,
        acceptedCount: 0,
        rejectedCount: 1,
        matchingCount: 0,
      },
      {
        source: 'website',
        documentCount: 1,
        acceptedCount: 1,
        rejectedCount: 0,
        matchingCount: 1,
      },
    ])
    expect(report.results[0].saleId).toBe(productId)
  })

  it('recovers an HTTP failure with a website match', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(cleanCodeSearchHtml))
    const report = await probeKyoboSearch(isbn)
    expect(report.stages[0].error).toContain('(503)')
    expect(report.results).toMatchObject([{ saleId: productId }])
    expect(report.error).toBeUndefined()
  })

  it('returns no matches only after full search confirms the empty result', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(emptyAutocompleteResponse))
      .mockResolvedValueOnce(new Response(emptyWebsite))
    expect(await searchKyobo(isbn)).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    new Response('Unavailable', { status: 503 }),
    new Response('<html>Challenge</html>'),
  ])(
    'throws rather than returning empty when fallback cannot establish an outcome',
    async (response) => {
      fetchMock
        .mockResolvedValueOnce(new Response(emptyAutocompleteResponse))
        .mockResolvedValueOnce(response)
      await expect(searchKyobo(isbn)).rejects.toThrow('website:')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    },
  )

  it('retains title punctuation and does not use ISBN fallback for keyword queries', async () => {
    fetchMock.mockResolvedValue(new Response(emptyAutocompleteResponse))
    expect(await searchKyobo(' Clean - Code ')).toEqual([])
    expect(fetchMock.mock.calls[0][0].searchParams.get('keyword')).toBe(
      'Clean - Code',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('bounds failed transport attempts and reports timeout context', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('Search timed out', 'TimeoutError'),
    )
    await expect(searchKyobo(isbn)).rejects.toThrow(
      'autocomplete: Search timed out; website: Search timed out',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retains a network exception cause in stage diagnostics when fallback recovers', async () => {
    fetchMock
      .mockRejectedValueOnce(
        new Error('fetch failed', { cause: new Error('connect ECONNREFUSED') }),
      )
      .mockResolvedValueOnce(new Response(cleanCodeSearchHtml))
    const report = await probeKyoboSearch(isbn)
    expect(report.stages[0].error).toContain(
      'fetch failed: connect ECONNREFUSED',
    )
    expect(report.results[0].saleId).toBe(productId)
  })

  it.each(['declared', 'streamed'])(
    'stops oversized %s bodies and allows one bounded fallback',
    async (kind) => {
      const cancel = vi.fn()
      const response =
        kind === 'declared'
          ? new Response(new ReadableStream({ cancel }), {
              headers: { 'content-length': '2000001' },
            })
          : new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array(2_000_001))
                },
                cancel,
              }),
            )
      fetchMock
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce(new Response(cleanCodeSearchHtml))
      const report = await probeKyoboSearch(isbn)
      expect(report.stages[0].error).toContain('too large')
      expect(cancel).toHaveBeenCalled()
      expect(report.results[0].saleId).toBe(productId)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    },
  )

  it('does not hide an oversized fallback body as a no-match response', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(emptyAutocompleteResponse))
      .mockResolvedValueOnce(
        new Response('too large', { headers: { 'content-length': '2000001' } }),
      )
    await expect(searchKyobo(isbn)).rejects.toThrow(
      'website: Kyobo search response is too large',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each(['', 'x'.repeat(121)])(
    'rejects invalid query bounds without fetching',
    async (query) => {
      await expect(searchKyobo(query)).rejects.toThrow('Enter a search keyword')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('keeps the reproduction fixture behind both nonproduction and explicit fixture guards', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('KYOBO_TEST_FIXTURE', '1')
    const report = await probeKyoboSearch(isbn)
    expect(report.stages.map((stage) => stage.source)).toEqual([
      'autocomplete',
      'website',
    ])
    expect(report.results[0].saleId).toBe(productId)
    expect(fetchMock).not.toHaveBeenCalled()
    vi.stubEnv('NODE_ENV', 'production')
    fetchMock
      .mockResolvedValueOnce(new Response(emptyAutocompleteResponse))
      .mockResolvedValueOnce(new Response(cleanCodeSearchHtml))
    expect(await searchKyobo(isbn)).toMatchObject([{ saleId: productId }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
