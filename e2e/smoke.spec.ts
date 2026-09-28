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
})
