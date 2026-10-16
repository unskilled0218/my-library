import { expect, test } from '@playwright/test'

test('an already-decoded ISBN recovers a website match missing from autocomplete', async ({
  page,
}) => {
  await page.goto('/search?q=978-0-13-235088-4&source=kyobo')
  const result = page.locator('#kyobo-result-S000006148336')
  await expect(
    result.getByRole('heading', { name: 'Clean Code', exact: true }),
  ).toBeVisible()
  await expect(result).toContainText('9780132350884')
  await expect(result).toContainText('Martin, Robert')
  const href = await result.getAttribute('href')
  const url = new URL(href!, page.url())
  expect(url.pathname).toBe('/search/kyobo/S000006148336')
  expect(url.searchParams.get('isbn')).toBe('9780132350884')
  expect(url.searchParams.get('q')).toBe('978-0-13-235088-4')
  expect(url.search.slice(1).length).toBeLessThanOrEqual(4000)
  await result.click()
  await expect(page).toHaveURL(/\/search\/kyobo\/S000006148336/)
  await expect(
    page.getByRole('heading', { name: 'Clean Code', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: '로그인하고 이 책 추가' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
})
