import type { Metadata } from 'next'
import Link from 'next/link'
import { currentAdmin, currentUser } from '@/lib/auth'
import { adminLogoutAction, logoutAction } from '@/app/actions'
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
        <header className="border-b border-ink/10 bg-paper/90 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
            <Link
              href={user ? '/libraries' : '/'}
              className="font-serif text-2xl font-black tracking-tight"
            >
              MY / LIBRARY
            </Link>
            <div className="flex items-center gap-2 text-sm">
              {user ? (
                <>
                  <span className="hidden text-ink/60 sm:inline">
                    {user.loginId}
                  </span>
                  <Link className="button button-secondary" href="/libraries">
                    Libraries
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
        <main>{children}</main>
      </body>
    </html>
  )
}
