import { cache } from 'react'
import type { User } from '@prisma/client'
import { cookies } from 'next/headers'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_COOKIE,
  type AppLanguage,
} from '@/lib/i18n/config'

export async function resolveLanguage(
  user: Pick<User, 'id'> | null,
): Promise<AppLanguage> {
  if (user) {
    const settings = await db.userDisplaySettings.findUnique({
      where: { userId: user.id },
      select: { language: true },
    })
    if (settings) return settings.language
  }
  return getCookieLanguage()
}

export const getLanguage = cache(async () =>
  resolveLanguage(await currentUser()),
)

export const getCookieLanguage = cache(async (): Promise<AppLanguage> => {
  const cookie = (await cookies()).get(LANGUAGE_COOKIE)?.value
  return isLanguage(cookie) ? cookie : DEFAULT_LANGUAGE
})
