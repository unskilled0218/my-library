import { expect, test, type Page } from '@playwright/test'

async function register(page: Page, prefix: string) {
  const loginId = `${prefix}-${Date.now()}-${test.info().project.name}`
  await page.goto('/register')
  await page.getByLabel('로그인 ID').fill(loginId)
  await page.getByLabel('비밀번호').fill('correct-horse-library-staple')
  await page.getByRole('button', { name: '계속' }).click()
  await expect(page).toHaveURL(/\/libraries$/)
  const libraryHref = await page
    .locator('#library-card-list a')
    .first()
    .getAttribute('href')
  expect(libraryHref).toBeTruthy()
  return { loginId, libraryHref: libraryHref! }
}

async function createChoices(
  page: Page,
  libraryHref: string,
  location: string,
  folder: string,
) {
  await page.goto('/settings')
  const tagForm = page.locator('#add-shelf-tag-form')
  await tagForm.locator('input[name="name"]').fill(location)
  await tagForm.getByRole('button').click()
  await expect(
    page.locator(`#shelf-tag-settings input[value="${location}"]`),
  ).toBeVisible()
  await page.goto(libraryHref)
  await page.locator('summary').filter({ hasText: '폴더 만들기' }).click()
  await page.locator('#folder-create-form').getByLabel('폴더 제목').fill(folder)
  await page
    .locator('#folder-create-form')
    .getByRole('button', { name: '폴더 만들기' })
    .click()
  await expect(
    page.getByRole('link', { name: folder, exact: true }),
  ).toBeVisible()
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

test('failed add-time retrieval saves nothing and retry keeps selected options in English', async ({
  page,
}) => {
  const { libraryHref } = await register(page, 'retry')
  await page.goto('/settings')
  await page.locator('select[name="language"]').selectOption('EN')
  await page.getByRole('button', { name: '언어 저장' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  const nonce = `${Date.now()}${test.info().project.name === 'mobile' ? '1' : '0'}${test.info().retry}`
  await page.goto(
    `/search?q=${encodeURIComponent(`deferred kyobo fixture ${nonce}`)}&source=kyobo`,
  )
  await page.getByRole('heading', { name: 'Deferred Kyobo Test Book' }).click()
  const form = page.locator('#kyobo-add-book-form')
  await expect(form).toBeVisible()
  await expect(
    page.getByText('Verified Contributor', { exact: false }),
  ).toHaveCount(0)
  await form.getByLabel('Ownership').selectOption('DONT_HAVE')
  await form.getByLabel('Reading state').selectOption('DONE')
  await form.getByLabel('Started').fill('2024-01-01')
  await form.getByLabel('Finished').fill('2024-02-01')
  await form.getByLabel('Rating').selectOption('5')
  await form.getByLabel('Personal comment').fill('Keep these options on retry')
  await form.getByRole('button', { name: 'Add to library' }).click()
  await expect(form.getByRole('alert')).toHaveText(
    'Book details are unavailable.',
  )
  await expect(form.getByLabel('Personal comment')).toHaveValue(
    'Keep these options on retry',
  )
  await expect(form.getByLabel('Ownership')).toHaveValue('DONT_HAVE')
  await expect(form.getByLabel('Reading state')).toHaveValue('DONE')
  await expect(form.getByLabel('Started')).toHaveValue('2024-01-01')
  await expect(form.getByLabel('Finished')).toHaveValue('2024-02-01')
  await expect(form.getByLabel('Rating')).toHaveValue('5')
  await expectNoOverflow(page)

  const checkLibrary = await page.context().newPage()
  await checkLibrary.goto(libraryHref)
  await expect(
    checkLibrary.getByRole('heading', { name: 'Deferred Kyobo Test Book' }),
  ).toHaveCount(0)
  await checkLibrary.close()

  await form.getByRole('button', { name: 'Add to library' }).click()
  await expect(page).toHaveURL(/\/search\?.*status=added/)
  await page.getByRole('link', { name: 'Go to library', exact: true }).click()
  await page.getByRole('heading', { name: 'Deferred Kyobo Test Book' }).click()
  await expect(
    page.getByText('Fixture Author, Verified Contributor'),
  ).toBeVisible()
  await expect(page.getByText('Fixture Genre', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Ownership')).toHaveValue('DONT_HAVE')
  await expect(page.getByLabel('Reading state')).toHaveValue('DONE')
  await expect(page.getByLabel('Started')).toHaveValue('2024-01-01')
  await expect(page.getByLabel('Finished')).toHaveValue('2024-02-01')
  await expect(page.getByLabel('Rating')).toHaveValue('5')
  await expect(page.getByLabel('Personal comment')).toHaveValue(
    'Keep these options on retry',
  )
})

test('destination switching resets tags and folders and an editor saves the library owner choices', async ({
  page,
  browser,
}) => {
  const editor = await register(page, 'options')
  await createChoices(page, editor.libraryHref, 'Editor shelf', 'Editor folder')
  const ownerContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  })
  try {
    const ownerPage = await ownerContext.newPage()
    const owner = await register(ownerPage, 'shared')
    await createChoices(
      ownerPage,
      owner.libraryHref,
      'Owner shelf',
      'Owner folder',
    )
    await ownerPage.goto(`${owner.libraryHref}/settings`)
    const sharing = ownerPage.locator('#library-share-form')
    await sharing.locator('input[name="loginId"]').fill(editor.loginId)
    await sharing.getByLabel('멤버 역할').selectOption('EDITOR')
    await sharing.getByRole('button', { name: '추가', exact: true }).click()
    await expect(ownerPage.locator('#library-sharing-settings')).toContainText(
      editor.loginId,
    )

    const ownId = editor.libraryHref.split('/').at(-1)!
    const sharedId = owner.libraryHref.split('/').at(-1)!
    await page.goto(`/search/kyobo/S000009999999?libraryId=${ownId}`)
    const form = page.locator('#kyobo-add-book-form')
    await form
      .getByLabel('위치', { exact: true })
      .selectOption({ label: 'Editor shelf' })
    await form
      .getByLabel('폴더', { exact: true })
      .selectOption({ label: 'Editor folder' })
    await form.getByLabel('개인 메모').fill('Shared library choices')
    await form.getByLabel('추가할 서재').selectOption(sharedId)
    await expect(form.getByLabel('위치', { exact: true })).toHaveValue('')
    await expect(form.getByLabel('폴더', { exact: true })).toHaveValue('')
    await expect(
      form.getByRole('option', { name: 'Editor shelf' }),
    ).toHaveCount(0)
    await expect(
      form.getByRole('option', { name: 'Editor folder' }),
    ).toHaveCount(0)
    await form
      .getByLabel('위치', { exact: true })
      .selectOption({ label: 'Owner shelf' })
    await form
      .getByLabel('폴더', { exact: true })
      .selectOption({ label: 'Owner folder' })
    await expectNoOverflow(page)
    await form.getByRole('button', { name: '서재에 추가' }).click()
    await expect(page).toHaveURL(/\/search\?.*status=added/)
    await page.goto(owner.libraryHref)
    await page
      .locator('#library-folder-list')
      .getByRole('heading', { name: 'Owner folder', exact: true })
      .click()
    await page
      .getByRole('heading', { name: 'Progressive Kyobo Test Book' })
      .click()
    await expect(
      page.locator('select[name="locationTagId"] option:checked'),
    ).toHaveText('Owner shelf')
    await expect(
      page.locator('select[name="folderId"] option:checked'),
    ).toHaveText('Owner folder')
    await expect(page.getByLabel('개인 메모')).toHaveValue(
      'Shared library choices',
    )
  } finally {
    await ownerContext.close()
  }
})
