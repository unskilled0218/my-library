import { z } from 'zod'

const dateField = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    )
  })

const optionSchema = z.object({
  ownershipState: z
    .string()
    .trim()
    .pipe(z.enum(['', 'HAVE', 'DONT_HAVE']))
    .transform((value) => value || 'HAVE'),
  locationTagId: z.string().trim(),
  folderId: z.string().trim(),
  readingState: z
    .string()
    .trim()
    .pipe(z.enum(['', 'NOT_STARTED', 'READING', 'DONE']))
    .transform((value) => value || 'NOT_STARTED'),
  readingStartedAt: dateField,
  readingFinishedAt: dateField,
  rating: z
    .string()
    .trim()
    .refine((value) => !value || /^[1-5]$/.test(value)),
  comment: z.string().trim().max(10_000),
})

const fieldErrors = {
  ownershipState: 'invalidOwnership',
  locationTagId: 'invalidLocation',
  folderId: 'invalidFolder',
  readingState: 'invalidReadingState',
  readingStartedAt: 'invalidDate',
  readingFinishedAt: 'invalidDate',
  rating: 'invalidRating',
  comment: 'commentTooLong',
} as const

export type BookOptionError =
  (typeof fieldErrors)[keyof typeof fieldErrors] | 'invalidDateOrder'
export type KyoboAddError =
  | BookOptionError
  | 'invalidProduct'
  | 'accessDenied'
  | 'detailsUnavailable'
  | 'alreadyExists'
  | 'saveFailed'
export type KyoboAddResult = { error: KyoboAddError }

export type BookOptions = {
  ownershipState: 'HAVE' | 'DONT_HAVE'
  locationTagId: string | null
  folderId: string | null
  readingState: 'NOT_STARTED' | 'READING' | 'DONE'
  readingStartedAt: Date | null
  readingFinishedAt: Date | null
  rating: number | null
  comment: string
}

export function parseBookOptions(
  form: FormData,
  now = new Date(),
): { options: BookOptions } | { error: BookOptionError } {
  const parsed = optionSchema.safeParse(
    Object.fromEntries(
      Object.keys(fieldErrors).map((key) => [key, form.get(key) ?? '']),
    ),
  )
  if (!parsed.success) {
    const field = parsed.error.issues[0].path[0] as keyof typeof fieldErrors
    return { error: fieldErrors[field] }
  }
  const data = parsed.data
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`)
  const readingStartedAt =
    data.readingState === 'NOT_STARTED'
      ? null
      : data.readingStartedAt
        ? new Date(`${data.readingStartedAt}T00:00:00.000Z`)
        : today
  const readingFinishedAt =
    data.readingState !== 'DONE'
      ? null
      : data.readingFinishedAt
        ? new Date(`${data.readingFinishedAt}T00:00:00.000Z`)
        : today
  if (
    readingStartedAt &&
    readingFinishedAt &&
    readingFinishedAt < readingStartedAt
  ) {
    return { error: 'invalidDateOrder' }
  }
  return {
    options: {
      ownershipState: data.ownershipState,
      locationTagId: data.locationTagId || null,
      folderId: data.folderId || null,
      readingState: data.readingState,
      readingStartedAt,
      readingFinishedAt,
      rating: data.rating ? Number(data.rating) : null,
      comment: data.comment,
    },
  }
}
