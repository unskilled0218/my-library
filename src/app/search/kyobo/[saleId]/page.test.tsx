import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KyoboDetailPage from '@/app/search/kyobo/[saleId]/page'
import { searchMessages } from '@/lib/i18n/search'

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getLanguage: vi.fn(),
  destinations: vi.fn(),
  choices: vi.fn(),
  getKyoboBook: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }))
vi.mock('@/lib/i18n/server', () => ({ getLanguage: mocks.getLanguage }))
vi.mock('@/lib/library-search', () => ({
  writableLibraryDestinations: mocks.destinations,
}))
vi.mock('@/lib/db', () => ({ db: { library: { findMany: mocks.choices } } }))
vi.mock('@/lib/kyobo', () => ({ getKyoboBook: mocks.getKyoboBook }))
vi.mock('@/app/actions', () => ({ addKyoboBookAction: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))

const preview = {
  title: 'Dune preview',
  author: 'Search author',
  isbn: '9791158887544',
  format: 'PHYSICAL',
  q: 'Dune',
  source: 'kyobo',
  libraryId: 'library-2',
}
async function renderPage(
  query: Record<string, string> = preview,
  saleId = 'S000001772370',
) {
  return renderToStaticMarkup(
    await KyoboDetailPage({
      params: Promise.resolve({ saleId }),
      searchParams: Promise.resolve(query),
    }),
  )
}

describe('deferred Kyobo review page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.currentUser.mockResolvedValue({ id: 'user-1' })
    mocks.getLanguage.mockResolvedValue('EN')
    mocks.destinations.mockResolvedValue([
      { id: 'library-1', name: 'First' },
      { id: 'library-2', name: 'Shared editor library' },
    ])
    mocks.choices.mockResolvedValue([
      {
        id: 'library-1',
        owner: { locationTags: [{ id: 'mine', name: 'My shelf' }] },
        folders: [],
      },
      {
        id: 'library-2',
        owner: { locationTags: [{ id: 'owners', name: 'Owner shelf' }] },
        folders: [
          { id: 'nested', title: 'Child', parentId: 'parent' },
          { id: 'parent', title: 'Parent', parentId: null },
        ],
      },
    ])
  })

  it('renders the preview, source and bounded return context without resolving full details', async () => {
    const html = await renderPage()
    expect(html).toContain('Dune preview')
    expect(html).toContain('Search author')
    expect(html).toContain(
      'https://product.kyobobook.co.kr/detail/S000001772370',
    )
    expect(html).toContain(
      '/search?q=Dune&amp;source=kyobo&amp;libraryId=library-2',
    )
    expect(html).toContain('value="library-2" selected=""')
    expect(html).toContain('Owner shelf')
    expect(html).toContain('— Child')
    expect(html).not.toContain('My shelf')
    expect(mocks.choices).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['library-1', 'library-2'] } },
      }),
    )
    expect(mocks.getKyoboBook).not.toHaveBeenCalled()
  })

  it.each(['KO', 'EN'] as const)(
    'allows a preview-free direct link in %s without scraping',
    async (language) => {
      mocks.getLanguage.mockResolvedValue(language)
      const html = await renderPage({ libraryId: 'unrelated' })
      expect(html).toContain(searchMessages[language].directLinkPreview)
      expect(html).toContain('id="kyobo-add-book-form"')
      expect(html).toContain('name="saleId" value="S000001772370"')
      expect(html).toContain('value="library-1" selected=""')
      expect(html).not.toContain('unrelated')
      expect(mocks.getKyoboBook).not.toHaveBeenCalled()
    },
  )

  it('shows sign-in guidance without querying private destination options or scraping', async () => {
    mocks.currentUser.mockResolvedValue(null)
    const html = await renderPage()
    expect(html).toContain('Sign in to add this book')
    expect(html).not.toContain('id="kyobo-add-book-form"')
    expect(mocks.destinations).not.toHaveBeenCalled()
    expect(mocks.choices).not.toHaveBeenCalled()
    expect(mocks.getKyoboBook).not.toHaveBeenCalled()
  })

  it('shows the no-writable-library state without option queries or scraping', async () => {
    mocks.destinations.mockResolvedValue([])
    const html = await renderPage()
    expect(html).toContain('You need an owned or editable library')
    expect(html).not.toContain('id="kyobo-add-book-form"')
    expect(mocks.choices).not.toHaveBeenCalled()
    expect(mocks.getKyoboBook).not.toHaveBeenCalled()
  })

  it('rejects invalid product IDs before loading user data', async () => {
    await expect(renderPage({}, '../invalid')).rejects.toThrow('NOT_FOUND')
    expect(mocks.currentUser).not.toHaveBeenCalled()
    expect(mocks.getKyoboBook).not.toHaveBeenCalled()
  })

  it('keeps legacy duplicate feedback and discards oversized preview fields', async () => {
    const html = await renderPage({
      ...preview,
      title: 'X'.repeat(1000),
      status: 'already-exists',
    })
    expect(html).toContain(searchMessages.EN.alreadyExists)
    expect(html).not.toContain('X'.repeat(1000))
    expect(mocks.getKyoboBook).not.toHaveBeenCalled()
  })
})
