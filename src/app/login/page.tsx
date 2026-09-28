import { userLoginAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await searchParams
  return (
    <AuthForm
      id="user-login-page"
      title="Welcome back"
      action={userLoginAction}
      error={error}
      success={success}
      alternate={{ label: 'Create an account', href: '/register' }}
    />
  )
}
