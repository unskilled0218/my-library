import { cookies } from 'next/headers'
import {
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_AGE,
  type AppLanguage,
} from '@/lib/i18n/config'

export async function setLanguageCookie(language: AppLanguage) {
  const jar = await cookies()
  jar.set(LANGUAGE_COOKIE, language, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: LANGUAGE_COOKIE_AGE,
  })
}
