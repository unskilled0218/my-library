import Link from 'next/link'

export function AuthForm({
  title,
  action,
  alternate,
  error,
  token,
}: {
  title: string
  action: (form: FormData) => Promise<void>
  alternate?: { label: string; href: string }
  error?: string
  token?: string
}) {
  return (
    <div className="mx-auto max-w-md px-5 py-20">
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
        <form action={action} className="mt-8 space-y-4">
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
            />
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
            />
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
