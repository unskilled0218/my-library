// Minimized from the live autocomplete/full-search mismatch for Clean Code.
export const KYOBO_SEARCH_FIXTURE_ISBN = '9780132350884'
export const emptyAutocompleteResponse = JSON.stringify({
  resultCode: '200',
  data: {
    returnCode: 1,
    totalSize: 0,
    realSize: 0,
    errorMessage: null,
    resultDocuments: [],
  },
})

export const cleanCodeSearchHtml = `<div id="result_contents" data-total-count="1">
  <div id="shopData_list"><ul class="prod_list"><li class="prod_item">
    <input class="result_checkbox spec_checkbox" type="checkbox" data-pid="S000006148336" data-bid="9780132350884" data-name="Clean Code" data-code="BNT">
    <a class="prod_info" href="https://product.kyobobook.co.kr/detail/S000006148336">[서양도서] 해외주문 · Clean Code</a>
    <a class="author rep">Martin, Robert</a><a class="author">Feathers, Michael C.</a><a class="author">Ottinger, Timothy R.</a>
    <div class="prod_publish"><a class="text">Pearson</a> · 2008년 08월 01일</div>
  </li></ul></div>
</div>`
