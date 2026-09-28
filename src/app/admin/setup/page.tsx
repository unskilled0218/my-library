import { notFound } from 'next/navigation'
import { ensureAdminSetupToken, setupAdminAction } from '@/app/actions'
import { AuthForm } from '@/components/auth-form'

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  if (!(await ensureAdminSetupToken())) notFound()
  const { token = '', error } = await searchParams
  return (
    <AuthForm
      id="admin-setup-page"
      title="Create initial administrator"
      action={setupAdminAction}
      token={token}
      error={error}
    />
  )
}
