import { passwordSchema } from '@/lib/validation'

export function passwordChangeError({
  currentMatches,
  newMatchesCurrent,
  newPassword,
  confirmation,
}: {
  currentMatches: boolean
  newMatchesCurrent: boolean
  newPassword: string
  confirmation: string
}) {
  if (!passwordSchema.safeParse(newPassword).success) return 'password-length'
  if (newPassword !== confirmation) return 'password-mismatch'
  if (!currentMatches) return 'password-incorrect'
  if (newMatchesCurrent) return 'password-different'
  return null
}
