import { registerAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'
import { authMessages } from '@/lib/i18n/auth'
import { getLanguage } from '@/lib/i18n/server'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const [{ error }, language] = await Promise.all([searchParams, getLanguage()])
  const messages = authMessages[language]
  return (
    <AuthForm
      id="registration-page"
      title={messages.registerTitle}
      action={registerAction}
      mode="register"
      language={language}
      error={error}
      alternate={{ label: messages.alreadyRegistered, href: '/login' }}
    />
  )
}
