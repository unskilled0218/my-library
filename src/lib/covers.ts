import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { imageSize } from 'image-size'
import { getEnv } from '@/lib/env'

const MAX_COVER_BYTES = 5 * 1024 * 1024
const ALLOWED_HOSTS = new Set(['contents.kyobobook.co.kr'])

function dimensions(bytes: Buffer) {
  const result = imageSize(bytes)
  if (
    !result.width ||
    !result.height ||
    result.width > 6_000 ||
    result.height > 6_000
  )
    throw new Error('Cover dimensions are invalid or too large')
  return { width: result.width, height: result.height }
}

function signature(buffer: Buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return { mime: 'image/jpeg', extension: 'jpg' }
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: 'image/png', extension: 'png' }
  if (
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WEBP'
  )
    return { mime: 'image/webp', extension: 'webp' }
  throw new Error('Unsupported cover image')
}

export async function downloadCover(input: string) {
  let url = new URL(input)
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname))
      throw new Error('Cover host is not allowed')
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Invalid cover redirect')
      url = new URL(location, url)
      continue
    }
    if (!response.ok)
      throw new Error(`Cover download failed (${response.status})`)
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_COVER_BYTES)
      throw new Error('Cover image is too large')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_COVER_BYTES)
      throw new Error('Cover image is empty or too large')
    const type = signature(bytes)
    const size = dimensions(bytes)
    const key = `${randomUUID()}.${type.extension}`
    await mkdir(getEnv().COVER_STORAGE_PATH, { recursive: true })
    await writeFile(
      path.join(/* turbopackIgnore: true */ getEnv().COVER_STORAGE_PATH, key),
      bytes,
      {
        flag: 'wx',
      },
    )
    return { key, mime: type.mime, ...size }
  }
  throw new Error('Too many cover redirects')
}

export async function saveCoverData(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_COVER_BYTES)
    throw new Error('Cover image is empty or too large')
  const type = signature(bytes)
  const size = dimensions(bytes)
  const key = `${randomUUID()}.${type.extension}`
  await mkdir(getEnv().COVER_STORAGE_PATH, { recursive: true })
  await writeFile(
    path.join(/* turbopackIgnore: true */ getEnv().COVER_STORAGE_PATH, key),
    bytes,
    {
      flag: 'wx',
    },
  )
  return { key, mime: type.mime, ...size }
}

export async function readCover(key: string) {
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key))
    throw new Error('Invalid cover key')
  return readFile(path.join(getEnv().COVER_STORAGE_PATH, key))
}

export async function removeCover(key?: string | null) {
  if (!key) return
  await unlink(path.join(getEnv().COVER_STORAGE_PATH, key)).catch(
    () => undefined,
  )
}
