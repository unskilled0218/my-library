import { expect, test, type Page } from '@playwright/test'

async function register(page: Page, prefix: string) {
  const loginId = `${prefix}-${Date.now()}-${test.info().project.name}`
  await page.goto('/register')
  await page.getByLabel('로그인 ID').fill(loginId)
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()
  await expect(page).toHaveURL(/\/libraries$/)
  return loginId
}

async function returnHome(page: Page) {
  await page.getByRole('link', { name: 'MY / LIBRARY' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('#libraries-page')).toBeVisible()
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

test('front page shows the library list and creates libraries without leaving the root entry point', async ({
  page,
}) => {
  await register(page, 'home')
  await page.goto('/')
  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: '내 서재', level: 1 }),
  ).toBeVisible()
  const cards = page.locator('#library-card-list')
  await expect(cards.getByRole('heading', { name: '내 서재' })).toBeVisible()
  const form = page.locator('#library-create-form')
  await expect(form).toBeVisible()
  expect(
    await form.evaluate((element) =>
      Boolean(
        element.compareDocumentPosition(
          document.querySelector('#library-card-list')!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ),
  ).toBe(true)
  await expectNoOverflow(page)

  const name = `Home library ${Date.now()}`
  await form.locator('input[name="name"]').fill(name)
  await form
    .locator('input[name="description"]')
    .fill('Created from the front page')
  await form.getByRole('button', { name: '서재 만들기' }).click()
  await expect(page).toHaveURL(/\/libraries\/[^/?]+$/)
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  const libraryHref = new URL(page.url()).pathname
  await returnHome(page)
  const card = cards.locator(`a[href="${libraryHref}"]`)
  await expect(card).toContainText(name)
  await expect(card).toContainText('Created from the front page')
  await expectNoOverflow(page)

  const rootCards = await cards.locator('a').allTextContents()
  await page.goto('/libraries')
  await expect(page).toHaveURL(/\/libraries$/)
  await expect(cards.locator('a')).toHaveText(rootCards)
  await expect(page.locator('#library-create-form')).toBeVisible()
})

test('returning home refreshes renamed and deleted library cards without reloading', async ({
  page,
}) => {
  await register(page, 'lifecycle')
  await page.goto('/')
  const card = page.locator('#library-card-list a').first()
  const libraryHref = await card.getAttribute('href')
  expect(libraryHref).toBeTruthy()
  await card.click()
  await page.locator('#library-settings-link').click()

  const name = `Renamed library ${Date.now()}`
  const description = 'Updated description shown after client navigation'
  const details = page.locator('#library-details-form')
  await details.getByLabel('이름', { exact: true }).fill(name)
  await details.getByLabel('설명', { exact: true }).fill(description)
  await details.getByRole('button', { name: '서재 저장' }).click()
  await expect(
    page.locator('[id^="library-settings-page-"] > div').first(),
  ).toContainText(name)
  await returnHome(page)
  const updatedCard = page.locator(
    `#library-card-list a[href="${libraryHref}"]`,
  )
  await expect(updatedCard).toContainText(name)
  await expect(updatedCard).toContainText(description)

  await updatedCard.click()
  await page.locator('#library-settings-link').click()
  await page
    .locator('#delete-library-form')
    .getByRole('button', { name: '서재 삭제' })
    .click()
  await expect(page).toHaveURL(/\/libraries$/)
  await returnHome(page)
  await expect(
    page.locator(`#library-card-list a[href="${libraryHref}"]`),
  ).toHaveCount(0)
  await expect(page.locator('#library-card-list')).toContainText(
    '아직 서재가 없습니다.',
  )
})

test('a private library appears on another user front page only after viewer sharing', async ({
  page,
  browser,
}) => {
  await register(page, 'owner')
  await returnHome(page)
  const name = `Private library ${Date.now()}`
  const form = page.locator('#library-create-form')
  await form.locator('input[name="name"]').fill(name)
  await form.getByRole('button', { name: '서재 만들기' }).click()
  await expect(page).toHaveURL(/\/libraries\/[^/?]+$/)
  const libraryHref = new URL(page.url()).pathname

  const viewerContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  })
  try {
    const viewer = await viewerContext.newPage()
    const viewerLoginId = await register(viewer, 'viewer')
    await returnHome(viewer)
    const sharedCard = viewer.locator(
      `#library-card-list a[href="${libraryHref}"]`,
    )
    await expect(sharedCard).toHaveCount(0)
    await expect(viewer.locator('#library-card-list a')).toHaveCount(1)

    await page.locator('#library-settings-link').click()
    const sharing = page.locator('#library-share-form')
    await sharing.locator('input[name="loginId"]').fill(viewerLoginId)
    await sharing.getByLabel('멤버 역할').selectOption('VIEWER')
    await sharing.getByRole('button', { name: '추가', exact: true }).click()
    await expect(page.locator('#library-sharing-settings')).toContainText(
      viewerLoginId,
    )

    await viewer.goto('/')
    await expect(sharedCard).toContainText(name)
    await expect(sharedCard).toContainText('열람자')
    await expect(viewer.locator('#library-create-form')).toBeVisible()
    await expect(viewer.locator('#library-card-list a')).toHaveCount(2)
    await expectNoOverflow(viewer)
  } finally {
    await viewerContext.close()
  }
})
