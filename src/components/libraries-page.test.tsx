// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from '@/app/page'
import LegacyLibrariesPage from '@/app/libraries/page'
import LibrariesPage from '@/components/libraries-page'
import { commonMessages } from '@/lib/i18n/common'
import { librariesMessages } from '@/lib/i18n/libraries'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  findMany: vi.fn(),
  getLanguage: vi.fn(),
  createLibraryAction: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/db', () => ({ db: { library: { findMany: mocks.findMany } } }))
vi.mock('@/lib/i18n/server', () => ({ getLanguage: mocks.getLanguage }))
vi.mock('@/app/actions', () => ({
  createLibraryAction: mocks.createLibraryAction,
}))

async function renderPage() {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(await LibrariesPage())
  return container
}

describe('shared protected library list', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 'reader-1' })
    mocks.findMany.mockResolvedValue([])
    mocks.getLanguage.mockResolvedValue('EN')
  })

  it('exposes the same protected page at both route entry points', () => {
    expect(HomePage).toBe(LibrariesPage)
    expect(LegacyLibrariesPage).toBe(LibrariesPage)
  })

  it.each([
    ['/', HomePage],
    ['/libraries', LegacyLibrariesPage],
  ] as const)(
    'stops signed-out requests to %s before querying libraries',
    async (_, page) => {
      mocks.requireUser.mockRejectedValue(new Error('REDIRECT:/login'))

      await expect(page()).rejects.toThrow('REDIRECT:/login')

      expect(mocks.findMany).not.toHaveBeenCalled()
    },
  )

  it('queries only owned or shared libraries with counts, roles, and newest updates first', async () => {
    await LibrariesPage()

    expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        OR: [
          { ownerId: 'reader-1' },
          { members: { some: { userId: 'reader-1' } } },
        ],
      },
      include: {
        _count: { select: { books: true } },
        members: { where: { userId: 'reader-1' }, select: { role: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  })

  it.each(['KO', 'EN'] as const)(
    'renders owned, editor, and viewer cards in %s',
    async (language) => {
      mocks.getLanguage.mockResolvedValue(language)
      mocks.findMany.mockResolvedValue([
        {
          id: 'owned',
          ownerId: 'reader-1',
          name: 'Owned library',
          description: 'Personal books',
          members: [{ role: 'VIEWER' }],
          _count: { books: 2 },
        },
        {
          id: 'edited',
          ownerId: 'other',
          name: 'Edited library',
          description: '',
          members: [{ role: 'EDITOR' }],
          _count: { books: 1 },
        },
        {
          id: 'viewed',
          ownerId: 'other',
          name: 'Viewed library',
          description: null,
          members: [{ role: 'VIEWER' }],
          _count: { books: 0 },
        },
      ])

      const container = await renderPage()
      const cards = container.querySelectorAll('#library-card-list a')
      const common = commonMessages[language]

      expect(container.querySelector('h1')?.textContent).toBe(
        librariesMessages[language].title,
      )
      expect(Array.from(cards, (card) => card.getAttribute('href'))).toEqual([
        '/libraries/owned',
        '/libraries/edited',
        '/libraries/viewed',
      ])
      expect(cards[0].textContent).toContain(common.owner)
      expect(cards[0].textContent).not.toContain(common.viewer)
      expect(cards[0].textContent).toContain('Personal books')
      expect(cards[0].textContent).toContain(
        language === 'KO' ? '2권' : '2 books',
      )
      expect(cards[1].textContent).toContain(common.editor)
      expect(cards[1].textContent).toContain(
        language === 'KO' ? '1권' : '1 book',
      )
      expect(cards[2].textContent).toContain(common.viewer)
      expect(cards[2].textContent).toContain(
        language === 'KO' ? '0권' : '0 books',
      )
      for (const card of [cards[1], cards[2]]) {
        expect(card.textContent).toContain(
          librariesMessages[language].noDescription,
        )
      }
    },
  )

  it.each(['KO', 'EN'] as const)(
    'keeps the localized creation form above the empty list in %s',
    async (language) => {
      mocks.getLanguage.mockResolvedValue(language)
      const container = await renderPage()
      const form = container.querySelector('#library-create-form')!
      const cards = container.querySelector('#library-card-list')!
      const name = form.querySelector<HTMLInputElement>('input[name="name"]')!
      const description = form.querySelector<HTMLInputElement>(
        'input[name="description"]',
      )!

      expect(
        form.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(name.required).toBe(true)
      expect(name.maxLength).toBe(100)
      expect(name.placeholder).toBe(librariesMessages[language].newLibraryName)
      expect(description.required).toBe(false)
      expect(description.maxLength).toBe(500)
      expect(description.placeholder).toBe(
        librariesMessages[language].descriptionPlaceholder,
      )
      expect(form.querySelector('button[type="submit"]')?.textContent).toBe(
        librariesMessages[language].createLibrary,
      )
      expect(cards.querySelectorAll('a')).toHaveLength(0)
      expect(cards.textContent).toBe(librariesMessages[language].noLibraries)
    },
  )
})
