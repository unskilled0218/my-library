import { userLoginAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'
import { authMessages } from '@/lib/i18n/auth'
import { getLanguage } from '@/lib/i18n/server'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const [{ error, success }, language] = await Promise.all([
    searchParams,
    getLanguage(),
  ])
  const messages = authMessages[language]
  return (
    <AuthForm
      id="user-login-page"
      title={messages.loginTitle}
      action={userLoginAction}
      mode="login"
      language={language}
      error={error}
      success={success}
      alternate={{ label: messages.createAccount, href: '/register' }}
    />
  )
}
