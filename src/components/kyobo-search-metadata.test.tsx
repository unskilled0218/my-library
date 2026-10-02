import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { KyoboSearchMetadata } from '@/components/kyobo-search-metadata'

describe('KyoboSearchMetadata', () => {
  it('renders every available user-facing value with localized labels', () => {
    const html = renderToStaticMarkup(
      <KyoboSearchMetadata
        language="EN"
        value={{
          category: 'Novel',
          publisher: 'Publisher',
          publicationYear: 2026,
          publicationMonth: 9,
          listPrice: 20000,
          salePrice: 18000,
          discountPercent: 10,
          rewardPoints: 900,
          rating: 4.8,
          description: 'Search description',
        }}
      />,
    )

    expect(html).toContain('Category')
    expect(html).toContain('Novel')
    expect(html).toContain('Publisher')
    expect(html).toContain('2026.09')
    expect(html).toContain('₩18,000')
    expect(html).toContain('₩20,000')
    expect(html).toContain('10%')
    expect(html).toContain('900P')
    expect(html).toContain('4.8/5')
    expect(html).toContain('Search description')
  })

  it('omits unavailable metadata instead of rendering empty labels', () => {
    const html = renderToStaticMarkup(
      <KyoboSearchMetadata language="KO" value={{ category: '소설' }} />,
    )

    expect(html).toContain('분류')
    expect(html).not.toContain('출판사')
    expect(html).not.toContain('판매가')
  })
})
