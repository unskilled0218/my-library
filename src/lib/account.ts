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
  if (!passwordSchema.safeParse(newPassword).success)
    return 'New password must be between 12 and 128 characters'
  if (newPassword !== confirmation)
    return 'New password confirmation does not match'
  if (!currentMatches) return 'Current password is incorrect'
  if (newMatchesCurrent) return 'New password must be different'
  return null
}
