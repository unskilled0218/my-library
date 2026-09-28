import { userLoginAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <AuthForm
      title="Welcome back"
      action={userLoginAction}
      error={error}
      alternate={{ label: 'Create an account', href: '/register' }}
    />
  )
}
