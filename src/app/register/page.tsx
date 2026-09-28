import { registerAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <AuthForm
      id="registration-page"
      title="Register freely"
      action={registerAction}
      error={error}
      alternate={{ label: 'Already registered?', href: '/login' }}
    />
  )
}
