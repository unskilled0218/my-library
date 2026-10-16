import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GlobalSearchPage from '@/app/search/page'
import { parseWebsiteSearchResponse } from '@/lib/kyobo'
import { cleanCodeSearchHtml } from '@/lib/kyobo-search-fixtures'
import { searchMessages } from '@/lib/i18n/search'

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  language: vi.fn(),
  destinations: vi.fn(),
  libraryResults: vi.fn(),
  kyobo: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ currentUser: mocks.currentUser }))
vi.mock('@/lib/i18n/server', () => ({ getLanguage: mocks.language }))
vi.mock('@/lib/library-search', () => ({
  writableLibraryDestinations: mocks.destinations,
  searchReadableLibraryBooks: mocks.libraryResults,
}))
vi.mock('@/lib/kyobo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/kyobo')>()),
  searchKyobo: mocks.kyobo,
}))
vi.mock('@/app/actions', () => ({ addManualBookAction: vi.fn() }))

async function renderPage(source = 'kyobo') {
  return renderToStaticMarkup(
    await GlobalSearchPage({
      searchParams: Promise.resolve({
        q: '9780132350884',
        source,
        libraryId: 'owned',
      }),
    }),
  )
}

describe('Kyobo ISBN search result states', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.currentUser.mockResolvedValue(null)
    mocks.language.mockResolvedValue('EN')
    mocks.destinations.mockResolvedValue([
      { id: 'owned', name: 'Owned library' },
    ])
    mocks.libraryResults.mockResolvedValue({ books: [], truncated: false })
    mocks.kyobo.mockResolvedValue(
      parseWebsiteSearchResponse(cleanCodeSearchHtml, '9780132350884'),
    )
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders the verified fallback identity and preview link for signed-out search', async () => {
    const html = await renderPage()
    expect(html).toContain('id="kyobo-result-S000006148336"')
    expect(html).toContain('Clean Code')
    const link = html
      .match(/href="(\/search\/kyobo\/[^\"]+)"/)![1]
      .replaceAll('&amp;', '&')
    const url = new URL(link, 'https://example.test')
    expect(url.pathname).toBe('/search/kyobo/S000006148336')
    expect(url.searchParams.get('isbn')).toBe('9780132350884')
    expect(url.searchParams.get('title')).toBe('Clean Code')
    expect(url.searchParams.get('source')).toBe('kyobo')
    expect(mocks.libraryResults).not.toHaveBeenCalled()
    expect(mocks.destinations).not.toHaveBeenCalled()
  })

  it.each(['KO', 'EN'] as const)(
    'distinguishes confirmed empty results from upstream failure in %s',
    async (language) => {
      mocks.language.mockResolvedValue(language)
      mocks.kyobo.mockResolvedValue([])
      const empty = await renderPage()
      expect(empty).toContain(searchMessages[language].noKyoboBooks)
      expect(empty).not.toContain('role="alert"')
      const error = new Error('website: unrecognized response')
      mocks.kyobo.mockRejectedValue(error)
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const failure = await renderPage()
      expect(failure).toContain(searchMessages[language].kyoboUnavailable)
      expect(failure).toContain('role="alert"')
      expect(failure).not.toContain(searchMessages[language].noKyoboBooks)
      expect(failure).not.toContain(error.message)
      expect(log).toHaveBeenCalledWith('Kyobo search failed', {
        query: '9780132350884',
        error,
      })
    },
  )

  it('combines Kyobo results with the signed-in readable-library lookup and retains its destination', async () => {
    mocks.currentUser.mockResolvedValue({ id: 'reader' })
    mocks.libraryResults.mockResolvedValue({
      books: [
        {
          id: 'local-book',
          title: 'Local copy',
          authors: ['Author'],
          coverKey: null,
          library: { name: 'Shared library' },
          readingState: 'READING',
          format: 'PHYSICAL',
        },
      ],
      truncated: false,
    })
    const html = await renderPage('all')
    expect(html).toContain('Local copy')
    expect(html).toContain('Clean Code')
    expect(mocks.libraryResults).toHaveBeenCalledWith('reader', '9780132350884')
    expect(html).toContain('libraryId=owned')
  })

  it('does not call Kyobo for an authenticated library-only search', async () => {
    mocks.currentUser.mockResolvedValue({ id: 'reader' })
    const html = await renderPage('library')
    expect(mocks.kyobo).not.toHaveBeenCalled()
    expect(mocks.libraryResults).toHaveBeenCalledWith('reader', '9780132350884')
    expect(html).not.toContain('id="kyobo-search-results"')
  })
})
