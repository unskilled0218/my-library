import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function importTestBook(
  page: Page,
  libraryHref: string,
  title: string,
  sourceId: string,
) {
  await page.goto(libraryHref)
  const result = await page.evaluate(
    async ({ libraryHref, title, sourceId }) => {
      const form = new FormData()
      form.set('apply', 'true')
      form.set(
        'file',
        new File(
          [
            JSON.stringify({
              version: 2,
              library: { name: 'Test', description: '' },
              books: [
                {
                  title,
                  authors: ['Test Author'],
                  isbn13: `978${sourceId.slice(-10).padStart(10, '0')}`,
                  sourceUrl: `https://product.kyobobook.co.kr/detail/${sourceId}`,
                  genrePaths: [
                    [
                      {
                        name: 'Test',
                        url: 'https://store.kyobobook.co.kr/category/domestic/01',
                      },
                    ],
                  ],
                },
              ],
            }),
          ],
          'book.json',
          { type: 'application/json' },
        ),
      )
      const response = await fetch(
        `/api${libraryHref.replace(/\?.*$/, '')}/transfer`,
        { method: 'POST', body: form },
      )
      return { status: response.status, body: await response.text() }
    },
    { libraryHref, title, sourceId },
  )
  expect(result.status, result.body).toBe(200)
  await page.goto(libraryHref)
}

test('signed-out front page redirects to a usable login page', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko-KR')
  await expect(page.locator('#user-login-page-form')).toBeVisible()
  await expect(page.getByLabel('로그인 ID')).toBeVisible()
  await expect(page.getByLabel('비밀번호')).toBeVisible()
  await expect(page.getByRole('button', { name: '계속' })).toBeVisible()
  const headerSearch = page.locator('#header-search-form')
  await expect(headerSearch.getByLabel('책 검색')).toBeVisible()
  await expect(headerSearch.locator('#header-search-source')).toHaveText(
    '교보문고',
  )
  await expect(headerSearch.locator('option[value="library"]')).toHaveCount(0)
  await expect(
    headerSearch.getByRole('button', { name: '검색' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  await expect(headerSearch.locator('#header-isbn-camera svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
})

test('mobile ISBN scanner is compact and viewport-centered', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'mobile', 'Mobile scanner layout')
  await page.goto('/')
  await page.locator('#header-isbn-camera').click()

  const dialog = page.locator('#header-scanner-dialog')
  const panel = page.locator('#header-scanner-panel')
  const video = page.locator('#isbn-scanner video')
  const close = page.getByRole('button', { name: '카메라 닫기' })
  await expect(dialog).toBeVisible()
  await expect(close).toBeVisible()

  const panelBox = await panel.boundingBox()
  const videoBox = await video.boundingBox()
  const viewport = page.viewportSize()
  expect(panelBox).not.toBeNull()
  expect(videoBox).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(videoBox!.height).toBeGreaterThanOrEqual(95)
  expect(videoBox!.height).toBeLessThanOrEqual(145)
  expect(
    Math.abs(panelBox!.y + panelBox!.height / 2 - viewport!.height / 2),
  ).toBeLessThanOrEqual(2)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)

  await page.setViewportSize({ width: 412, height: 260 })
  await close.scrollIntoViewIfNeeded()
  await expect(close).toBeVisible()
  const shortDialogBox = await dialog.boundingBox()
  const shortPanelBox = await panel.boundingBox()
  expect(shortDialogBox?.height).toBe(260)
  expect(shortPanelBox!.y).toBeGreaterThanOrEqual(11)
  expect(shortPanelBox!.y + shortPanelBox!.height).toBeLessThanOrEqual(249)
  await close.click()
  await expect(dialog).toHaveCount(0)
})

test('Kyobo full information is retrieved only when adding from the review page', async ({
  page,
}) => {
  const loginId = `kyobo-${Date.now()}-${test.info().project.name}`
  await page.goto('/register')
  await page.getByLabel('로그인 ID').fill(loginId)
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()

  const search = page.locator('#header-search-form')
  await search.getByLabel('책 검색').fill('progressive kyobo fixture')
  await search.getByRole('button', { name: '검색' }).click()
  const candidate = page.getByRole('heading', {
    name: 'Progressive Kyobo Test Book',
  })
  await expect(candidate).toBeVisible()
  const result = page.locator('#kyobo-result-S000009999999')
  await expect(result).toContainText('Fixture Category')
  await expect(result).toContainText('Fixture Publisher')
  await expect(result).toContainText('2026.09')
  await expect(result).toContainText('18,000')
  await expect(result).toContainText('4.8/5')
  await expect(result).toContainText(
    'Deterministic canonical details loaded after the preview.',
  )
  await candidate.click({ noWaitAfter: true })

  await expect(page).toHaveURL(/\/search\/kyobo\/S000009999999/)
  await expect(
    page.getByRole('heading', { name: 'Progressive Kyobo Test Book' }),
  ).toBeVisible()
  await expect(
    page.getByText('Verified Contributor', { exact: false }),
  ).toHaveCount(0)
  await expect(page.getByText('Fixture Genre')).toHaveCount(0)
  await expect(page.locator('#kyobo-details-loading')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '서재에 추가' })).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)

  await page.goBack()
  await expect(candidate).toBeVisible()
  await candidate.click()
  const addForm = page.locator('#kyobo-add-book-form')
  await addForm.getByLabel('소유 상태').selectOption('DONT_HAVE')
  await addForm.getByLabel('평점').selectOption('4')
  await addForm.getByLabel('개인 메모').fill('Added with my options')
  await addForm.getByRole('button', { name: '서재에 추가' }).click()
  await expect(page.getByRole('status')).toContainText(
    '교보문고에서 책 정보를 가져와 추가하고 있습니다.',
  )
  await expect(page).toHaveURL(/\/search\?.*status=added/)
  await page.getByRole('link', { name: '서재로 이동', exact: true }).click()
  await page
    .getByRole('heading', { name: 'Progressive Kyobo Test Book' })
    .click()
  await expect(
    page.getByText('Fixture Author, Verified Contributor'),
  ).toBeVisible()
  await expect(page.getByText('Fixture Genre', { exact: true })).toBeVisible()
  await expect(page.getByLabel('소유 상태')).toHaveValue('DONT_HAVE')
  await expect(page.getByLabel('평점')).toHaveValue('4')
  await expect(page.getByLabel('개인 메모')).toHaveValue(
    'Added with my options',
  )
  await expect(page.getByLabel('제목', { exact: true })).not.toBeEditable()
  await expect(page.getByLabel('저자', { exact: true })).not.toBeEditable()
})

test('a user can register and receives a default library', async ({ page }) => {
  const loginId = `reader-${Date.now()}-${test.info().project.name}`
  await page.goto('/register')
  await page.getByLabel('로그인 ID').fill(loginId)
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()
  await expect(page).toHaveURL(/\/libraries/)
  await expect(
    page.getByRole('heading', { name: '내 서재', level: 1 }),
  ).toBeVisible()

  await page
    .locator('#site-navigation')
    .getByRole('link', { name: '설정' })
    .click()
  await page.locator('select[name="language"]').selectOption('EN')
  const saveLanguage = page.getByRole('button', { name: '언어 저장' })
  await expect(saveLanguage.locator('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await saveLanguage.click()
  await expect(page.getByText('Display language updated.')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('link', { name: 'MY / LIBRARY' }).click()
  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Your libraries' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: '내 서재' })).toBeVisible()

  const createForm = page.locator('#library-create-form')
  const libraryCards = page.locator('#library-card-list')
  await expect(createForm).toBeVisible()
  await expect(libraryCards).toBeVisible()
  expect(
    await page.evaluate(() => {
      const form = document.querySelector('#library-create-form')
      const cards = document.querySelector('#library-card-list')
      return Boolean(
        form &&
        cards &&
        form.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }),
  ).toBe(true)

  await page
    .locator('#library-card-list')
    .getByRole('heading', { name: '내 서재' })
    .click()
  const searchRow = page.locator('#library-search-row')
  await expect(searchRow).toBeVisible()
  await expect(searchRow.locator('#library-search-input')).toBeVisible()
  await expect(searchRow.locator('#library-search-button')).toBeVisible()
  await expect(searchRow.locator('#library-filter-toggle')).toBeVisible()
  await expect(
    searchRow.getByRole('button', { name: 'Filter' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  expect(
    await page.evaluate(() => {
      const search = document.querySelector('#library-search-button')
      const filter = document.querySelector('#library-filter-toggle')
      return Boolean(
        search &&
        filter &&
        search.compareDocumentPosition(filter) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
    }),
  ).toBe(true)
  await expect(page.locator('#library-filter-panel')).toBeHidden()
  await expect(page.locator('#header-search-source')).toHaveValue('all')
  await expect(
    page.locator('#header-search-source option[value="kyobo"]'),
  ).toHaveCount(1)
  await expect(
    page.locator('#header-search-source option[value="library"]'),
  ).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Add from Kyobo' })).toHaveCount(
    0,
  )

  await page.locator('#library-filter-toggle').click()
  await expect(page.locator('#library-filter-panel')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Hide filters' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  await page.locator('#library-hide-filters').click()
  await expect(page.locator('#library-filter-panel')).toBeHidden()
  await page.locator('#library-filter-toggle').click()
  await page.reload()
  await expect(page.locator('#library-filter-panel')).toBeHidden()

  await page.evaluate(() => window.scrollTo(0, 300))
  const beforeViewChange = await page.evaluate(() => ({
    url: window.location.href,
    scrollY: window.scrollY,
  }))
  await expect(
    page.getByRole('button', { name: 'Grid' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  const listView = page.getByRole('button', { name: 'List' })
  await expect(listView.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  await listView.evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('#library-book-list')).toHaveAttribute(
    'data-view',
    'LIST',
  )
  const afterViewChange = await page.evaluate(() => ({
    url: window.location.href,
    scrollY: window.scrollY,
  }))
  expect(afterViewChange).toEqual(beforeViewChange)

  const siteNavigation = page.locator('#site-navigation')
  await expect(
    siteNavigation.getByRole('link', { name: 'Settings' }),
  ).toBeVisible()
  await expect(
    siteNavigation.getByRole('link', { name: 'Settings' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  await expect(
    siteNavigation.getByRole('link', { name: 'Libraries' }),
  ).toHaveCount(0)
  await siteNavigation.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.locator('#change-password-form')).toBeVisible()
  await expect(page.getByLabel('Current password')).toBeVisible()
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Confirm new password')).toBeVisible()
  await expect(page.locator('#global-settings-list')).toHaveAttribute(
    'data-layout',
    'list',
  )
  await expect(page.locator('#export-all-libraries')).toHaveAttribute(
    'href',
    '/api/settings/transfer',
  )
  await expect(page.locator('#account-import-panel')).toBeVisible()

  await page.locator('#add-shelf-tag-form input[name="name"]').fill('Study')
  await page.getByRole('button', { name: 'Add shelf tag' }).click()
  await expect(page.getByLabel('Rename Study')).toHaveValue('Study')
  await expect(
    page.getByRole('button', { name: 'Save Study' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  await expect(
    page.getByRole('button', { name: 'Delete Study' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  await page.getByLabel('Default layout').selectOption('LIST')
  const saveDisplay = page.getByRole('button', { name: 'Save display' })
  await expect(saveDisplay.locator('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await saveDisplay.click()

  await page.getByRole('link', { name: 'MY / LIBRARY' }).click()
  await page
    .locator('#library-create-form input[name="name"]')
    .fill('Second library')
  await page.getByRole('button', { name: 'Create library' }).click()
  await expect(
    page.getByRole('heading', { name: 'Second library' }),
  ).toBeVisible()
  await expect(page.locator('#library-book-list')).toHaveAttribute(
    'data-view',
    'LIST',
  )
  await page.locator('#library-filter-toggle').click()
  await expect(page.getByLabel('Location')).toContainText('Study')
  await expect(page.locator('#library-editor-settings')).toHaveCount(0)
  await expect(page.locator('#library-owner-settings')).toHaveCount(0)

  const librarySettings = page
    .locator('#library-header')
    .getByRole('link', { name: 'Settings' })
  await expect(librarySettings.locator('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await librarySettings.click()
  await expect(
    page.getByRole('heading', { name: 'Library settings' }),
  ).toBeVisible()
  await expect(page.locator('[id^="library-settings-page-"]')).toHaveAttribute(
    'data-layout',
    'list',
  )
  await expect(page.getByRole('link', { name: /Statistics/ })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Import \/ export/ }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Audit log/ })).toBeVisible()
  await expect(page.locator('#library-sharing-settings')).toBeVisible()
  await expect(page.locator('#library-ownership-settings')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Save library' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  await expect(
    page.getByRole('button', { name: 'Delete library' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
})

test('an owner can manage independent EPUB and PDF files', async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().project.name}`
  await page.goto('/register')
  await page.getByLabel('로그인 ID').fill(`files-${suffix}`)
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()
  const libraryHref = await page
    .locator('#library-card-list a')
    .first()
    .getAttribute('href')
  expect(libraryHref).toBeTruthy()
  await importTestBook(
    page,
    libraryHref!,
    `File test ${suffix}`,
    'S000000000001',
  )
  await page.getByRole('heading', { name: `File test ${suffix}` }).click()
  await page.getByLabel('EPUB 파일 선택').setInputFiles({
    name: 'first.epub',
    mimeType: 'application/epub+zip',
    buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]),
  })
  const epubResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/files/EPUB') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'EPUB 업로드' }).click()
  const epubResponse = await epubResponsePromise
  expect(epubResponse.status(), await epubResponse.text()).toBe(201)
  await expect(page.getByRole('link', { name: 'EPUB 다운로드' })).toHaveText(
    'first.epub',
  )

  await page.getByLabel('PDF 파일 선택').setInputFiles({
    name: 'manual.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nfirst'),
  })
  await page.getByRole('button', { name: 'PDF 업로드' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'PDF 다운로드' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('manual.pdf')
  expect(await readFile((await download.path())!, 'utf8')).toContain('%PDF-1.7')

  await page.getByLabel('PDF 파일 선택').setInputFiles({
    name: 'replacement.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nreplacement'),
  })
  await page.getByRole('button', { name: 'PDF 교체' }).click()
  await expect(page.getByRole('link', { name: 'PDF 다운로드' })).toHaveText(
    'replacement.pdf',
  )
  await expect(page.getByRole('link', { name: 'EPUB 다운로드' })).toHaveText(
    'first.epub',
  )

  await page.getByRole('button', { name: 'EPUB 삭제' }).click()
  await expect(page.getByRole('link', { name: 'EPUB 다운로드' })).toHaveCount(0)
  await expect(page.getByText('업로드된 파일이 없습니다.')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'PDF 다운로드' })).toBeVisible()
})

test('an owner can organize books in nested folders', async ({ page }) => {
  const suffix = `${Date.now()}-${test.info().project.name}`
  const parentTitle = `Parent ${suffix}`
  const childTitle = `Child ${suffix}`
  const bookTitle = `Folder book ${suffix}`
  await page.goto('/register')
  await page.getByLabel('로그인 ID').fill(`folders-${suffix}`)
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()
  await page
    .locator('#library-card-list')
    .getByRole('heading', { name: '내 서재' })
    .click()
  await expect(page).toHaveURL(/\/libraries\/[^/?]+$/)
  const libraryHref = new URL(page.url()).pathname

  let folderForm = page.locator('#folder-create-form')
  await page.locator('summary').filter({ hasText: '폴더 만들기' }).click()
  await folderForm.getByLabel('폴더 제목').fill(parentTitle)
  await folderForm.getByLabel('폴더 표지').selectOption('upload')
  await folderForm.getByLabel('사용자 지정 표지 이미지').setInputFiles({
    name: 'folder.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nGQAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await folderForm.getByRole('button', { name: '폴더 만들기' }).click()
  await expect(page.getByRole('link', { name: parentTitle })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await page.locator('summary').filter({ hasText: '폴더 만들기' }).click()
  folderForm = page.locator('#folder-create-form')
  await folderForm.getByLabel('폴더 제목').fill(childTitle)
  await folderForm.getByRole('button', { name: '폴더 만들기' }).click()
  await expect(page.getByRole('link', { name: childTitle })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await importTestBook(page, libraryHref, bookTitle, 'S000000000002')
  await page.getByRole('heading', { name: bookTitle }).click()
  await expect(page).toHaveURL(/\/books\//)
  await page
    .locator('select[name="folderId"]')
    .selectOption({ label: `— ${childTitle}` })
  await page.getByRole('button', { name: '책 저장' }).click()
  await page
    .getByRole('link', { name: `${childTitle} 폴더로 돌아가기` })
    .click()
  await expect(page.getByRole('heading', { name: bookTitle })).toBeVisible()

  await page.getByRole('link', { name: '서재 홈' }).click()
  const parentCard = page.getByRole('link', { name: new RegExp(parentTitle) })
  await expect(parentCard.locator('img')).toHaveAttribute(
    'src',
    /\/api\/folders\/.+\/cover/,
  )
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
})
