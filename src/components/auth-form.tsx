import Link from 'next/link'

export function AuthForm({
  id,
  title,
  action,
  alternate,
  error,
  success,
  token,
}: {
  id: string
  title: string
  action: (form: FormData) => Promise<void>
  alternate?: { label: string; href: string }
  error?: string
  success?: string
  token?: string
}) {
  return (
    <div id={id} className="mx-auto max-w-md px-5 py-20">
      <div className="panel">
        <p className="eyebrow">My Library</p>
        <h1 className="mt-3 font-serif text-4xl font-bold">{title}</h1>
        {error && (
          <p
            className="mt-4 rounded-xl bg-rust/10 p-3 text-sm text-rust"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            className="mt-4 rounded-xl bg-moss/10 p-3 text-sm text-moss"
            role="status"
          >
            {success}
          </p>
        )}
        <form id={`${id}-form`} action={action} className="mt-8 space-y-4">
          {token !== undefined && (
            <input type="hidden" name="token" value={token} />
          )}
          <label className="block text-sm font-semibold">
            Login ID
            <input
              className="mt-1"
              name="loginId"
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
              3-40 characters: letters, numbers, dots, underscores, or hyphens.
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Password
            <input
              className="mt-1"
              type="password"
              name="password"
              autoComplete={
                title.includes('Register') || title.includes('administrator')
                  ? 'new-password'
                  : 'current-password'
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
              At least 12 characters.
            </span>
          </label>
          <button className="w-full" type="submit">
            Continue
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
