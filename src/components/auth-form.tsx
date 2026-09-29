import Link from 'next/link'
import type { AppLanguage } from '@/lib/i18n/config'
import { authErrorKeys, authMessages } from '@/lib/i18n/auth'

export function AuthForm({
  id,
  title,
  action,
  alternate,
  error,
  success,
  token,
  mode,
  language,
}: {
  id: string
  title: string
  action: (form: FormData) => Promise<void>
  alternate?: { label: string; href: string }
  error?: string
  success?: string
  token?: string
  mode: 'login' | 'register' | 'setup'
  language: AppLanguage
}) {
  const messages = authMessages[language]
  const errorMessage = error
    ? messages[authErrorKeys[error as keyof typeof authErrorKeys]]
    : undefined
  const successMessage = success
    ? messages[authErrorKeys[success as keyof typeof authErrorKeys]]
    : undefined
  return (
    <div id={id} className="mx-auto max-w-md px-5 py-20">
      <div className="panel">
        <p className="eyebrow">My Library</p>
        <h1 className="mt-3 font-serif text-4xl font-bold">{title}</h1>
        {errorMessage && (
          <p
            className="mt-4 rounded-xl bg-rust/10 p-3 text-sm text-rust"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p
            className="mt-4 rounded-xl bg-moss/10 p-3 text-sm text-moss"
            role="status"
          >
            {successMessage}
          </p>
        )}
        <form id={`${id}-form`} action={action} className="mt-8 space-y-4">
          {token !== undefined && (
            <input type="hidden" name="token" value={token} />
          )}
          <label className="block text-sm font-semibold">
            {messages.loginId}
            <input
              className="mt-1"
              name="loginId"
              aria-label={messages.loginId}
              autoComplete="username"
              required
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9._-]+"
              aria-describedby="login-id-help"
            />
            <span
              id="login-id-help"
              className="mt-1 block text-xs font-normal text-ink/55"
            >
              {messages.loginHelp}
            </span>
          </label>
          <label className="block text-sm font-semibold">
            {messages.password}
            <input
              className="mt-1"
              type="password"
              name="password"
              aria-label={messages.password}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              required
              minLength={12}
              maxLength={128}
              aria-describedby="password-help"
            />
            <span
              id="password-help"
              className="mt-1 block text-xs font-normal text-ink/55"
            >
              {messages.passwordHelp}
            </span>
          </label>
          <button className="w-full" type="submit">
            {messages.continue}
          </button>
        </form>
        {alternate && (
          <Link
            className="mt-5 block text-center text-sm font-semibold text-moss underline"
            href={alternate.href}
          >
            {alternate.label}
          </Link>
        )}
      </div>
    </div>
  )
}
