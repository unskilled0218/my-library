import { adminLoginAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <AuthForm
      id="admin-login-page"
      title="Administrator sign in"
      action={adminLoginAction}
      error={error}
    />
  )
}
