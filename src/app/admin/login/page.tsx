import { adminLoginAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'
import { authMessages } from '@/lib/i18n/auth'
import { getCookieLanguage } from '@/lib/i18n/server'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, language] = await Promise.all([
    searchParams,
    getCookieLanguage(),
  ])
  return (
    <AuthForm
      id="admin-login-page"
      title={authMessages[language].adminLoginTitle}
      action={adminLoginAction}
      mode="login"
      language={language}
      error={error}
    />
  )
}
