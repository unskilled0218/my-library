import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getKyoboBook,
  parseProductHtml,
  parseSearchResponse,
  searchKyobo,
} from '@/lib/kyobo'

const searchPayload = JSON.stringify({
  resultCode: '200',
  data: {
    returnCode: 1,
    resultDocuments: [
      {
        CMDTCODE: '9791157107223',
        CMDT_NAME: '너의 췌장을 먹고 싶어',
        SALE_CMDTID: 'S000001750574',
        SALE_CMDT_DVSN_CODE_SUB: 'KOR',
        TOT_RELATE_HTML_LIST:
          '9791157107223$@소설$@너의 췌장을 먹고 싶어$@스미노 요루$@소미미디어$@2017$@04$@13800.00$@12420.00$@10.00$@690$@N$@N$@KOR$@https://contents.kyobobook.co.kr/cover.jpg$@0$@0$@0$@0$@0$@5.00$@검색 결과 책 소개$@$@0$@0$@0$@010517$@0',
      },
    ],
  },
})

const productHtml = `<!doctype html><html><body>
  <h1 aria-label="너의 췌장을 먹고 싶어"><span>너의 췌장을 먹고 싶어</span></h1>
  <a href="#authorInfo">스미노 요루</a><a href="#authorInfo">양윤옥</a>
  <img alt="너의 췌장을 먹고 싶어 대표 이미지" src="https://contents.kyobobook.co.kr/cover.jpg">
  <table><tr><th>ISBN</th><td>9791157107223</td></tr></table>
  <div id="bookSimpleIntro">잔혹한 비밀을 가진 소녀와 임시 친구 계약을 맺은 소년의 이야기!</div>
  <ul class="flex flex-col justify-start">
    <li><ul><li><a href="https://store.kyobobook.co.kr/category/domestic">국내도서</a></li><li><a href="https://store.kyobobook.co.kr/category/domestic/01">소설</a></li><li><a href="https://store.kyobobook.co.kr/category/domestic/0105">일본소설</a></li><li><a href="https://store.kyobobook.co.kr/category/domestic/010517">드라마/영화소설</a></li></ul></li>
    <li><ul><li><a href="https://store.kyobobook.co.kr/category/domestic">국내도서</a></li><li><a href="https://store.kyobobook.co.kr/category/domestic/01">소설</a></li><li><a href="https://store.kyobobook.co.kr/category/domestic/0128">장르소설</a></li><li><a href="https://store.kyobobook.co.kr/category/domestic/012819">드라마/영화소설</a></li></ul></li>
  </ul>
</body></html>`

describe('deferred add-time fixtures', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('scopes first-attempt failure to each product and leaves preview searches independent', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('KYOBO_TEST_FIXTURE', '1')
    vi.useFakeTimers()
    const [first] = await searchKyobo('deferred kyobo fixture 123456789')
    const [second] = await searchKyobo('deferred kyobo fixture 987654321')
    expect(first.saleId).not.toBe(second.saleId)
    const initialFailure = expect(getKyoboBook(first.saleId)).rejects.toThrow(
      'Deterministic first add attempt failed',
    )
    await vi.advanceTimersByTimeAsync(1500)
    await initialFailure
    const success = getKyoboBook(first.saleId)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(success).resolves.toMatchObject({
      title: first.title,
      authors: ['Fixture Author', 'Verified Contributor'],
    })
    const separateFailure = expect(getKyoboBook(second.saleId)).rejects.toThrow(
      'Deterministic first add attempt failed',
    )
    await vi.advanceTimersByTimeAsync(1500)
    await separateFailure
  })
})

describe('Kyobo provider parsing', () => {
  it('uses the first exact ISBN result', () => {
    expect(
      parseSearchResponse(searchPayload, '9791157107223')[0],
    ).toMatchObject({
      saleId: 'S000001750574',
      authors: ['스미노 요루'],
      isbn: '9791157107223',
      category: '소설',
      publisher: '소미미디어',
      publicationYear: 2017,
      publicationMonth: 4,
      listPrice: 13800,
      salePrice: 12420,
      discountPercent: 10,
      rewardPoints: 690,
      rating: 5,
      description: '검색 결과 책 소개',
      categoryCode: '010517',
    })
    expect(parseSearchResponse(searchPayload, '1111111111111')).toEqual([])
  })

  it('drops malformed optional fields without rejecting the candidate', () => {
    const payload = JSON.parse(searchPayload)
    const fields =
      payload.data.resultDocuments[0].TOT_RELATE_HTML_LIST.split('$@')
    fields[5] = '3020'
    fields[6] = '13'
    fields[7] = '-1'
    fields[8] = 'free'
    fields[9] = '101'
    fields[10] = '1.5'
    fields[20] = '6'
    fields[26] = '../category'
    payload.data.resultDocuments[0].TOT_RELATE_HTML_LIST = fields.join('$@')

    expect(parseSearchResponse(JSON.stringify(payload), 'book')[0]).toEqual(
      expect.objectContaining({
        publicationYear: undefined,
        publicationMonth: undefined,
        listPrice: undefined,
        salePrice: undefined,
        discountPercent: undefined,
        rewardPoints: undefined,
        rating: undefined,
        categoryCode: undefined,
      }),
    )
  })

  it('deduplicates sale IDs while preserving distinct editions', () => {
    const payload = JSON.parse(searchPayload)
    const original = payload.data.resultDocuments[0]
    payload.data.resultDocuments.push(
      { ...original, CMDT_NAME: 'Duplicate should not replace first' },
      {
        ...original,
        CMDTCODE: '4801157107223',
        SALE_CMDTID: 'E000001750574',
        SALE_CMDT_DVSN_CODE_SUB: 'UNKNOWN',
      },
    )

    const results = parseSearchResponse(JSON.stringify(payload), 'title')
    expect(results.map((book) => book.saleId)).toEqual([
      'S000001750574',
      'E000001750574',
    ])
    expect(results[1].format).toBe('EBOOK')
    expect(results[0].title).toBe('너의 췌장을 먹고 싶어')
  })

  it('skips malformed runtime documents while retaining valid results', () => {
    const payload = JSON.parse(searchPayload)
    payload.data.resultDocuments.unshift(
      null,
      { CMDTCODE: 123, CMDT_NAME: {}, SALE_CMDTID: [] },
      {
        CMDTCODE: '9791234567890',
        CMDT_NAME: 'Malformed optional fields',
        SALE_CMDTID: 'S123',
        TOT_RELATE_HTML_LIST: { unexpected: true },
      },
    )

    const results = parseSearchResponse(JSON.stringify(payload), 'title')
    expect(results).toHaveLength(2)
    expect(results.map((book) => book.saleId)).toEqual([
      'S123',
      'S000001750574',
    ])
    expect(results[0].category).toBeUndefined()
  })

  it('extracts contributors, short description, and every genre path', () => {
    const result = parseProductHtml(productHtml, 'S000001750574')
    expect(result.authors).toEqual(['스미노 요루', '양윤옥'])
    expect(result.description).toContain('잔혹한 비밀')
    expect(result.genrePaths).toHaveLength(2)
    expect(result.genrePaths[1].at(-1)?.url).toContain('012819')
  })

  it('rejects incomplete product markup', () => {
    expect(() => parseProductHtml('<h1 aria-label="Book"></h1>', 'S1')).toThrow(
      'missing required metadata',
    )
  })
})
