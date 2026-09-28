import { z } from 'zod'

export const loginIdSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/)
  .transform((value) => value.toLowerCase())

export const passwordSchema = z.string().min(12).max(128)

export const kyoboBookUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'product.kyobobook.co.kr' &&
      /^\/detail\/[A-Z]\d+$/.test(url.pathname)
    )
  }, 'A canonical Kyobo product URL is required')

export const kyoboGenreUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'store.kyobobook.co.kr' &&
      url.pathname.startsWith('/category/')
    )
  }, 'A canonical Kyobo genre URL is required')

export function normalizeIsbn(value: string) {
  return value.replace(/[-\s]/g, '')
}

export function normalizeLoginId(value: string) {
  return loginIdSchema.parse(value)
}
