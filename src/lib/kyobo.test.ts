import { describe, expect, it } from 'vitest'
import { parseProductHtml, parseSearchResponse } from '@/lib/kyobo'

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
          '9791157107223$@소설$@너의 췌장을 먹고 싶어$@스미노 요루$@출판사$@2017$@https://contents.kyobobook.co.kr/cover.jpg',
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

describe('Kyobo provider parsing', () => {
  it('uses the first exact ISBN result', () => {
    expect(
      parseSearchResponse(searchPayload, '9791157107223')[0],
    ).toMatchObject({
      saleId: 'S000001750574',
      authors: ['스미노 요루'],
      isbn: '9791157107223',
    })
    expect(parseSearchResponse(searchPayload, '1111111111111')).toEqual([])
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
