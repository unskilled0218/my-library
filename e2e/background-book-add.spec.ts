import { expect, test, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasourceUrl: process.env.PLAYWRIGHT_DATABASE_URL,
})
test.afterAll(async () => {
  await db.$disconnect()
})

async function register(page: Page) {
  await page.goto('/register')
  await page
    .getByLabel('로그인 ID')
    .fill(
      `background-${Date.now()}-${test.info().project.name}-${test.info().retry}`,
    )
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()
  await expect(page).toHaveURL(/\/libraries$/)
  const href = (await page
    .locator('#library-card-list a')
    .first()
    .getAttribute('href'))!
  await page.goto('/settings')
  await page.locator('select[name="language"]').selectOption('EN')
  await page.getByRole('button', { name: '언어 저장' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  return { href, libraryId: href.split('/').at(-1)! }
}

function gate() {
  let release!: () => void
  let entered!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const ready = new Promise<void>((resolve) => {
    entered = resolve
  })
  return { pending, ready, release, entered }
}

test('actual header and library searches preserve pending work until the real POST is released', async ({
  page,
}) => {
  const { href, libraryId } = await register(page)
  const folder = await db.libraryFolder.create({
    data: { libraryId, title: 'Background navigation folder' },
  })
  const held = gate()
  await page.route('**/api/books/kyobo', async (route) => {
    held.entered()
    await held.pending
    await route.fulfill({ response: await route.fetch() })
  })
  try {
    await page.goto(`/search/kyobo/S000009999999?libraryId=${libraryId}`)
    await page.evaluate(() => {
      ;(window as Window & { backgroundMarker?: string }).backgroundMarker =
        'same-document'
    })
    const form = page.locator('#kyobo-add-book-form')
    await form.getByLabel('Personal comment').fill('Saved after navigation')
    await form.getByRole('button', { name: 'Add to library' }).click()
    await held.ready
    const panel = page.locator('#book-add-status')
    await expect(panel.locator('[data-task-state="pending"]')).toBeVisible()
    const header = page.locator('#header-search-form')
    await header.getByLabel('Search books').fill('progressive kyobo fixture')
    await header.getByLabel('Search source').selectOption('kyobo')
    await header.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page).toHaveURL(
      /\/search\?q=progressive\+kyobo\+fixture&source=kyobo/,
    )
    await expect(panel.locator('[data-task-state="pending"]')).toBeVisible()
    await page.getByRole('link', { name: 'MY / LIBRARY' }).click()
    await page.locator(`#library-card-list a[href="${href}"]`).click()
    await page.getByRole('link', { name: folder.title, exact: true }).click()
    await page.locator('#library-filter-toggle').click()
    await page
      .locator('#library-filters select[name="reading"]')
      .selectOption('READING')
    await page
      .locator('#library-filters')
      .getByLabel('Search books')
      .fill('Unmatched filter')
    await page.locator('#library-search-button').click()
    await expect(page).toHaveURL(/q=Unmatched\+filter/)
    expect(new URL(page.url()).searchParams.get('folder')).toBe(folder.id)
    expect(new URL(page.url()).searchParams.get('reading')).toBe('READING')
    expect(
      await page.evaluate(
        () =>
          (window as Window & { backgroundMarker?: string }).backgroundMarker,
      ),
    ).toBe('same-document')
    await expect(panel.locator('[data-task-state="pending"]')).toBeVisible()
    const toggle = panel.getByRole('button', { name: /Book additions/ })
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    held.release()
    await expect(panel.getByRole('status')).toContainText('Book added')
    await expect(page).toHaveURL(/q=Unmatched\+filter/)
    await toggle.click()
    await expect(panel.locator('[data-task-state="success"]')).toBeVisible()
    const book = await db.book.findFirstOrThrow({ where: { libraryId } })
    expect(book.comment).toBe('Saved after navigation')
    expect(
      await db.auditLog.count({
        where: { targetId: book.id, action: 'BOOK_CREATED' },
      }),
    ).toBe(1)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await panel.getByRole('link', { name: 'View and edit book' }).click()
    await expect(page).toHaveURL(new RegExp(`/books/${book.id}$`))
  } finally {
    held.release()
  }
})

test('different additions complete independently and a failure remains retryable after navigation', async ({
  page,
}) => {
  const { libraryId } = await register(page)
  const { ownerId } = await db.library.findUniqueOrThrow({
    where: { id: libraryId },
  })
  const secondLibrary = await db.library.create({
    data: { ownerId, name: 'Independent background destination' },
  })
  const nonce = `${Date.now()}${test.info().project.name === 'mobile' ? '1' : '0'}${test.info().retry}`
  const saleId = `S888${nonce}`
  const held = gate()
  await page.route('**/api/books/kyobo', async (route) => {
    if (route.request().postData()?.includes(saleId)) {
      held.entered()
      await held.pending
    }
    await route.fulfill({ response: await route.fetch() })
  })
  try {
    await page.goto(`/search/kyobo/${saleId}?libraryId=${libraryId}`)
    const form = page.locator('#kyobo-add-book-form')
    await form.getByLabel('Personal comment').fill('Retained after leaving')
    await form.getByRole('button', { name: 'Add to library' }).click()
    await held.ready
    const header = page.locator('#header-search-form')
    await header.getByLabel('Search books').fill('progressive kyobo fixture')
    await header.getByLabel('Search source').selectOption('kyobo')
    await header.getByRole('button', { name: 'Search', exact: true }).click()
    await page
      .getByRole('heading', { name: 'Progressive Kyobo Test Book' })
      .click()
    await form.getByLabel('Destination library').selectOption(secondLibrary.id)
    await form.getByLabel('Personal comment').fill('Independent second save')
    await form.getByRole('button', { name: 'Add to library' }).click()
    const panel = page.locator('#book-add-status')
    await expect(panel.locator('[data-task-state="success"]')).toHaveCount(1)
    await expect(panel.locator('[data-task-state="pending"]')).toHaveCount(1)
    await page.getByRole('link', { name: 'MY / LIBRARY' }).click()
    held.release()
    await expect(panel.getByRole('alert')).toContainText(
      'details are unavailable',
    )
    expect(await db.book.count({ where: { libraryId } })).toBe(0)
    await panel.getByRole('button', { name: 'Retry addition' }).click()
    await expect(panel.locator('[data-task-state="success"]')).toHaveCount(2)
    await expect(page).toHaveURL(/\/libraries$/)
    const first = await db.book.findFirstOrThrow({ where: { libraryId } })
    const second = await db.book.findFirstOrThrow({
      where: { libraryId: secondLibrary.id },
    })
    expect(first.comment).toBe('Retained after leaving')
    expect(second.comment).toBe('Independent second save')
  } finally {
    held.release()
  }
})

test('a committed but lost response reconciles explicit retry with the existing book', async ({
  page,
}) => {
  const { libraryId } = await register(page)
  let first = true
  await page.route('**/api/books/kyobo', async (route) => {
    const response = await route.fetch()
    if (first) {
      first = false
      expect((await response.json()).status).toBe('created')
      expect(await db.book.count({ where: { libraryId } })).toBe(1)
      await route.abort('failed')
    } else await route.fulfill({ response })
  })
  await page.goto(`/search/kyobo/S000009999999?libraryId=${libraryId}`)
  const form = page.locator('#kyobo-add-book-form')
  await form.getByLabel('Personal comment').fill('Original committed options')
  await form.getByLabel('Ownership').selectOption('DONT_HAVE')
  await form.getByRole('button', { name: 'Add to library' }).click()
  const panel = page.locator('#book-add-status')
  await expect(panel.getByRole('alert')).toContainText('outcome is unknown')
  await page.getByRole('link', { name: 'MY / LIBRARY' }).click()
  await panel.getByRole('link', { name: 'Edit options' }).click()
  await expect(form.getByLabel('Personal comment')).toHaveValue(
    'Original committed options',
  )
  await expect(form.getByLabel('Ownership')).toHaveValue('DONT_HAVE')
  await form.getByLabel('Personal comment').fill('Do not apply this retry')
  await form.getByRole('button', { name: 'Add to library' }).click()
  await expect(panel.locator('[data-task-state="existing"]')).toBeVisible()
  await expect(panel).toContainText(
    'Options from this request were not applied',
  )
  await expect(
    panel.getByRole('button', { name: 'Retry addition' }),
  ).toHaveCount(0)
  const books = await db.book.findMany({ where: { libraryId } })
  expect(books).toHaveLength(1)
  expect(books[0].comment).toBe('Original committed options')
  expect(books[0].ownershipState).toBe('DONT_HAVE')
  expect(
    await db.auditLog.count({
      where: { targetId: books[0].id, action: 'BOOK_CREATED' },
    }),
  ).toBe(1)
  await panel.getByRole('link', { name: 'View and edit book' }).click()
  await expect(page).toHaveURL(new RegExp(`/books/${books[0].id}$`))
})
