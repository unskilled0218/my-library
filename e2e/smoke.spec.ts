import { expect, test } from '@playwright/test'

test('landing page is usable', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Every book has a place and a story.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Start a library' }),
  ).toBeVisible()
})

test('a user can register and receives a default library', async ({ page }) => {
  const loginId = `reader-${Date.now()}-${test.info().project.name}`
  await page.goto('/register')
  await page.getByLabel('Login ID').fill(loginId)
  await page.getByLabel('Password').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/libraries/)
  await expect(
    page.getByRole('heading', { name: 'Your libraries' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'My library' })).toBeVisible()

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

  await page.getByRole('heading', { name: 'My library' }).click()
  const searchRow = page.locator('#library-search-row')
  await expect(searchRow).toBeVisible()
  await expect(searchRow.locator('#library-search-input')).toBeVisible()
  await expect(searchRow.locator('#library-search-button')).toBeVisible()
  await expect(searchRow.locator('#library-filter-toggle')).toBeVisible()
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

  await page.locator('#library-filter-toggle').click()
  await expect(page.locator('#library-filter-panel')).toBeVisible()
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
  await page.locator('#library-list-view').click()
  await expect(page.locator('#library-book-list')).toHaveAttribute(
    'data-view',
    'LIST',
  )
  const afterViewChange = await page.evaluate(() => ({
    url: window.location.href,
    scrollY: window.scrollY,
  }))
  expect(afterViewChange).toEqual(beforeViewChange)
})
