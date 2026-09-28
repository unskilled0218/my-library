import { z } from 'zod'

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    COVER_STORAGE_PATH: z.string().min(1).default('./covers'),
    ADMIN_ID: z.string().trim().min(3).optional(),
    ADMIN_PASSWORD: z.string().min(12).optional(),
  })
  .refine(
    (value) => Boolean(value.ADMIN_ID) === Boolean(value.ADMIN_PASSWORD),
    {
      message: 'ADMIN_ID and ADMIN_PASSWORD must be provided together',
    },
  )

export function getEnv() {
  return schema.parse(process.env)
}
