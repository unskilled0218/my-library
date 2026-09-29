import { expect, test } from '@playwright/test'

test('landing page is usable', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko-KR')
  await expect(
    page.getByRole('heading', {
      name: '모든 책에는 자리와 이야기가 있습니다.',
    }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: '서재 시작하기' })).toBeVisible()
  const headerSearch = page.locator('#header-search-form')
  await expect(headerSearch.getByLabel('책 검색')).toBeVisible()
  await expect(headerSearch.locator('#header-search-source')).toHaveText(
    '교보문고',
  )
  await expect(headerSearch.locator('option[value="library"]')).toHaveCount(0)
  await expect(
    headerSearch.getByRole('button', { name: '검색' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  await expect(
    headerSearch.getByRole('button', { name: 'ISBN 스캔' }).locator('svg'),
  ).toHaveAttribute('aria-hidden', 'true')
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
})

test('a user can register and receives a default library', async ({ page }) => {
  const loginId = `reader-${Date.now()}-${test.info().project.name}`
  await page.goto('/register')
  await page.getByLabel('로그인 ID').fill(loginId)
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()
  await expect(page).toHaveURL(/\/libraries/)
  await expect(page.getByRole('heading', { name: '내 서재' })).toBeVisible()

  await page
    .locator('#site-navigation')
    .getByRole('link', { name: '설정' })
    .click()
  await page.getByLabel('언어').selectOption('EN')
  const saveLanguage = page.getByRole('button', { name: '언어 저장' })
  await expect(saveLanguage.locator('svg')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await saveLanguage.click()
  await expect(page.getByText('Display language updated.')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('link', { name: 'MY / LIBRARY' }).click()
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

  await page.getByRole('heading', { name: '내 서재' }).click()
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
  await listView.click()
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
