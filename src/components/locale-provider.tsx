'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { AppLanguage } from '@/lib/i18n/config'

const LocaleContext = createContext<AppLanguage | null>(null)

export function LocaleProvider({
  children,
  language,
}: {
  children: ReactNode
  language: AppLanguage
}) {
  return (
    <LocaleContext.Provider value={language}>{children}</LocaleContext.Provider>
  )
}

export function useLanguage() {
  const language = useContext(LocaleContext)
  if (!language) throw new Error('LocaleProvider is missing')
  return language
}
