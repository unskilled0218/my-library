import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { currentAdmin, currentUser } from '@/lib/auth'
import { adminLogoutAction, logoutAction } from '@/app/actions'
import { HeaderSearch } from '@/components/header-search'
import { SettingsIcon } from '@/components/icons'
import { LocaleProvider } from '@/components/locale-provider'
import { BookAddProvider } from '@/components/book-add-provider'
import { LANGUAGE_TAGS } from '@/lib/i18n/config'
import { getCookieLanguage, getLanguage } from '@/lib/i18n/server'
import { shellMessages } from '@/lib/i18n/shell'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const admin = await currentAdmin()
  const language = admin ? await getCookieLanguage() : await getLanguage()
  return {
    title: { default: 'My Library', template: '%s | My Library' },
    description: shellMessages[language].metadataDescription,
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, admin] = await Promise.all([currentUser(), currentAdmin()])
  const language = admin ? await getCookieLanguage() : await getLanguage()
  const messages = shellMessages[language]
  return (
    <html lang={LANGUAGE_TAGS[language]}>
      <body>
        <LocaleProvider language={language}>
          <BookAddProvider userId={user?.id ?? null}>
            <header
              id="site-header"
              className="border-b border-ink/10 bg-paper/90 backdrop-blur"
            >
              <nav
                id="site-navigation"
                className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 md:px-8"
              >
                <Link
                  href="/"
                  className="font-serif text-2xl font-black tracking-tight"
                >
                  MY / LIBRARY
                </Link>
                {!admin ? (
                  <div className="col-span-3 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
                    <Suspense fallback={<div className="h-10" />}>
                      <HeaderSearch authenticated={Boolean(user)} />
                    </Suspense>
                  </div>
                ) : (
                  <div />
                )}
                <div className="col-start-3 row-start-1 flex items-center gap-2 text-sm">
                  {user ? (
                    <>
                      <span className="hidden text-ink/60 sm:inline">
                        {user.loginId}
                      </span>
                      <Link
                        className="button button-secondary h-12 w-12 p-0"
                        href="/settings"
                        aria-label={messages.settings}
                      >
                        <SettingsIcon />
                      </Link>
                      <form action={logoutAction}>
                        <button type="submit">{messages.signOut}</button>
                      </form>
                    </>
                  ) : admin ? (
                    <>
                      <Link className="button button-secondary" href="/admin">
                        {messages.admin}
                      </Link>
                      <form action={adminLogoutAction}>
                        <button type="submit">{messages.signOut}</button>
                      </form>
                    </>
                  ) : (
                    <>
                      <Link className="button button-secondary" href="/login">
                        {messages.signIn}
                      </Link>
                      <Link className="button" href="/register">
                        {messages.register}
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </header>
            <main id="app-content">{children}</main>
          </BookAddProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
