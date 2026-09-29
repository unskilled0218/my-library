import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LANGUAGE,
  defineMessages,
  formatCount,
  formatDateTime,
  isLanguage,
  LANGUAGE_TAGS,
} from '@/lib/i18n/config'

describe('i18n configuration', () => {
  it('defaults to Korean and rejects invalid values', () => {
    expect(DEFAULT_LANGUAGE).toBe('KO')
    expect(LANGUAGE_TAGS.KO).toBe('ko-KR')
    expect(LANGUAGE_TAGS.EN).toBe('en')
    expect(isLanguage('KO')).toBe(true)
    expect(isLanguage('EN')).toBe(true)
    expect(isLanguage('FR')).toBe(false)
  })

  it('keeps message keys aligned and formats counts', () => {
    const messages = defineMessages({ hello: '안녕' }, { hello: 'Hello' })
    expect(messages.EN.hello).toBe('Hello')
    expect(formatCount('KO', 2, '권', 'book')).toBe('2권')
    expect(formatCount('EN', 1, '권', 'book')).toBe('1 book')
    expect(formatCount('EN', 2, '권', 'book')).toBe('2 books')
  })

  it('formats dates with an explicit locale', () => {
    const date = new Date('2026-09-29T12:00:00Z')
    expect(formatDateTime('KO', date)).not.toBe(formatDateTime('EN', date))
  })
})
