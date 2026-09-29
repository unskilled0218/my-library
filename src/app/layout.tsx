import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { currentAdmin, currentUser } from '@/lib/auth'
import { adminLogoutAction, logoutAction } from '@/app/actions'
import { HeaderSearch } from '@/components/header-search'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'My Library', template: '%s | My Library' },
  description: 'A private home for the books you keep and read.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, admin] = await Promise.all([currentUser(), currentAdmin()])
  return (
    <html lang="en">
      <body>
        <header
          id="site-header"
          className="border-b border-ink/10 bg-paper/90 backdrop-blur"
        >
          <nav
            id="site-navigation"
            className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 md:px-8"
          >
            <Link
              href={user ? '/libraries' : '/'}
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
                  <Link className="button button-secondary" href="/settings">
                    Settings
                  </Link>
                  <form action={logoutAction}>
                    <button type="submit">Sign out</button>
                  </form>
                </>
              ) : admin ? (
                <>
                  <Link className="button button-secondary" href="/admin">
                    Admin
                  </Link>
                  <form action={adminLogoutAction}>
                    <button type="submit">Sign out</button>
                  </form>
                </>
              ) : (
                <>
                  <Link className="button button-secondary" href="/login">
                    Sign in
                  </Link>
                  <Link className="button" href="/register">
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main id="app-content">{children}</main>
      </body>
    </html>
  )
}
