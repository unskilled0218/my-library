export const LANGUAGES = ['KO', 'EN'] as const
export type AppLanguage = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: AppLanguage = 'KO'
export const LANGUAGE_COOKIE = 'my_library_language'
export const LANGUAGE_COOKIE_AGE = 60 * 60 * 24 * 365
export const LANGUAGE_TAGS: Record<AppLanguage, string> = {
  KO: 'ko-KR',
  EN: 'en',
}

export function isLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && LANGUAGES.includes(value as AppLanguage)
}

export function defineMessages<const Korean extends Record<string, string>>(
  korean: Korean,
  english: { [Key in keyof Korean]: string },
) {
  return { KO: korean, EN: english }
}

export function formatDateTime(language: AppLanguage, value: Date) {
  return new Intl.DateTimeFormat(LANGUAGE_TAGS[language], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

export function formatCount(
  language: AppLanguage,
  count: number,
  koreanUnit: string,
  englishSingular: string,
  englishPlural = `${englishSingular}s`,
) {
  if (language === 'KO') return `${count}${koreanUnit}`
  return `${count} ${count === 1 ? englishSingular : englishPlural}`
}
