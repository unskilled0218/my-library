import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { commonMessages } from '@/lib/i18n/common'
import { searchMessages } from '@/lib/i18n/search'
import type { KyoboBook } from '@/lib/kyobo'
import {
  KyoboDetails,
  KyoboDetailsLoading,
} from '@/app/search/kyobo/[saleId]/page'

vi.mock('@/app/actions', () => ({ addKyoboBookAction: vi.fn() }))

const book: KyoboBook = {
  saleId: 'S000001772370',
  title: 'Canonical Dune',
  authors: ['Frank Herbert'],
  isbn: '9791158887544',
  sourceUrl: 'https://product.kyobobook.co.kr/detail/S000001772370',
  format: 'PHYSICAL',
  coverUrl: null,
  description: 'Canonical product description',
  genrePaths: [
    [
      {
        name: 'Science fiction',
        url: 'https://store.kyobobook.co.kr/category/domestic/01',
      },
    ],
  ],
}

const baseProps = {
  saleId: book.saleId,
  context: { q: 'Dune', source: 'kyobo' as const },
  preview: {
    title: 'Dune preview',
    authors: ['Search author'],
    isbn: '1234567890',
    format: 'EBOOK' as const,
    coverUrl: null,
  },
  messages: searchMessages.EN,
  common: commonMessages.EN,
  duplicate: false,
}

describe('progressive Kyobo details', () => {
  it('renders a stable, announced loading state', () => {
    const html = renderToStaticMarkup(
      <KyoboDetailsLoading messages={searchMessages.EN} />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Loading additional information from Kyobo.')
    expect(html).toContain('min-h-64')
  })

  it('renders canonical details and a validated destination after loading', async () => {
    const element = await KyoboDetails({
      ...baseProps,
      result: Promise.resolve({ book, error: false }),
      signedIn: true,
      destinations: [
        { id: 'library-1', name: 'First' },
        { id: 'library-2', name: 'Second' },
      ],
      selectedDestinationId: 'library-2',
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Canonical Dune')
    expect(html).toContain('Canonical product description')
    expect(html).toContain('Science fiction')
    expect(html).toContain('Verified on the Kyobo product page')
    expect(html).toContain('value="library-2" selected=""')
    expect(html).toContain('name="title" value="Dune preview"')
  })

  it('shows canonical identity when a direct URL has no preview', async () => {
    const element = await KyoboDetails({
      ...baseProps,
      preview: null,
      result: Promise.resolve({ book, error: false }),
      signedIn: false,
      destinations: [],
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Canonical Dune')
    expect(html).toContain('9791158887544')
    expect(html).toContain('Format: Physical')
  })

  it('keeps failure navigation usable without rendering an add form', async () => {
    const element = await KyoboDetails({
      ...baseProps,
      result: Promise.resolve({ book: null, error: true }),
      signedIn: true,
      destinations: [{ id: 'library-1', name: 'First' }],
      selectedDestinationId: 'library-1',
    })
    const html = renderToStaticMarkup(element)

    expect(html).toContain('Book details are unavailable.')
    expect(html).toContain('Try again')
    expect(html).toContain('Back to results')
    expect(html).not.toContain('<form')
  })

  it('shows sign-in and no-destination states without an add form', async () => {
    const anonymous = await KyoboDetails({
      ...baseProps,
      result: Promise.resolve({ book, error: false }),
      signedIn: false,
      destinations: [],
    })
    const noDestination = await KyoboDetails({
      ...baseProps,
      result: Promise.resolve({ book, error: false }),
      signedIn: true,
      destinations: [],
    })

    expect(renderToStaticMarkup(anonymous)).toContain(
      'Sign in to add this book',
    )
    expect(renderToStaticMarkup(noDestination)).toContain(
      'You need an owned or editable library',
    )
  })
})
