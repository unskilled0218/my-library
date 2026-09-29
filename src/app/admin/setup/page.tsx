import { notFound } from 'next/navigation'
import { ensureAdminSetupToken, setupAdminAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'
import { authMessages } from '@/lib/i18n/auth'
import { getCookieLanguage } from '@/lib/i18n/server'

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  if (!(await ensureAdminSetupToken())) notFound()
  const [{ token = '', error }, language] = await Promise.all([
    searchParams,
    getCookieLanguage(),
  ])
  return (
    <AuthForm
      id="admin-setup-page"
      title={authMessages[language].adminSetupTitle}
      action={setupAdminAction}
      mode="setup"
      language={language}
      token={token}
      error={error}
    />
  )
}
