import type { AppLanguage } from '@/lib/i18n/config'
import { searchMessages } from '@/lib/i18n/search'

export type KyoboSearchMetadataValue = {
  category?: string | null
  publisher?: string | null
  publicationYear?: number | null
  publicationMonth?: number | null
  listPrice?: number | null
  salePrice?: number | null
  discountPercent?: number | null
  rewardPoints?: number | null
  rating?: number | null
  description?: string | null
}

function formatWon(value: number, language: AppLanguage) {
  return new Intl.NumberFormat(language === 'KO' ? 'ko-KR' : 'en-US', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number, language: AppLanguage) {
  return new Intl.NumberFormat(language === 'KO' ? 'ko-KR' : 'en-US').format(
    value,
  )
}

export function KyoboSearchMetadata({
  value,
  language,
}: {
  value: KyoboSearchMetadataValue
  language: AppLanguage
}) {
  const messages = searchMessages[language]
  const publication = value.publicationYear
    ? `${value.publicationYear}${value.publicationMonth ? `.${String(value.publicationMonth).padStart(2, '0')}` : ''}`
    : null
  const hasCommercialMetadata =
    value.listPrice != null ||
    value.salePrice != null ||
    value.discountPercent != null ||
    value.rewardPoints != null ||
    value.rating != null

  return (
    <div className="mt-3 min-w-0 space-y-2 break-words text-sm text-ink/65">
      {(value.category || value.publisher || publication) && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {value.category && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.categoryLabel}</dt>
              <dd>{value.category}</dd>
            </div>
          )}
          {value.publisher && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.publisherLabel}</dt>
              <dd>{value.publisher}</dd>
            </div>
          )}
          {publication && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.publicationLabel}</dt>
              <dd>{publication}</dd>
            </div>
          )}
        </dl>
      )}
      {hasCommercialMetadata && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          {value.salePrice != null && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.salePriceLabel}</dt>
              <dd>{formatWon(value.salePrice, language)}</dd>
            </div>
          )}
          {value.listPrice != null && value.listPrice !== value.salePrice && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.listPriceLabel}</dt>
              <dd className="line-through">
                {formatWon(value.listPrice, language)}
              </dd>
            </div>
          )}
          {value.discountPercent != null && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.discountLabel}</dt>
              <dd>{formatNumber(value.discountPercent, language)}%</dd>
            </div>
          )}
          {value.rewardPoints != null && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.rewardLabel}</dt>
              <dd>{formatNumber(value.rewardPoints, language)}P</dd>
            </div>
          )}
          {value.rating != null && (
            <div className="flex gap-1">
              <dt className="font-semibold">{messages.ratingLabel}</dt>
              <dd>{formatNumber(value.rating, language)}/5</dd>
            </div>
          )}
        </dl>
      )}
      {value.description && (
        <p className="max-h-24 overflow-hidden leading-6 text-ink/60">
          {value.description}
        </p>
      )}
    </div>
  )
}
