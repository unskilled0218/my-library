import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BookFileType } from '@prisma/client'
import { getEnv } from '@/lib/env'

export const MAX_BOOK_FILE_BYTES = 100 * 1024 * 1024

const definitions = {
  EPUB: {
    extension: 'epub',
    mime: 'application/epub+zip',
    declaredMimes: new Set([
      '',
      'application/epub+zip',
      'application/zip',
      'application/octet-stream',
    ]),
  },
  PDF: {
    extension: 'pdf',
    mime: 'application/pdf',
    declaredMimes: new Set(['', 'application/pdf', 'application/octet-stream']),
  },
} as const

export class BookFileValidationError extends Error {
  constructor(
    readonly code: 'invalid-file' | 'file-too-large',
    message: string,
  ) {
    super(message)
  }
}

export function parseBookFileType(value: string): BookFileType | null {
  return value === 'EPUB' || value === 'PDF' ? value : null
}

function normalizedName(input: string, extension: string) {
  const basename = path.posix.basename(input.replaceAll('\\', '/')).trim()
  if (
    !basename ||
    /[\u0000-\u001f\u007f]/.test(basename) ||
    !basename.toLowerCase().endsWith(`.${extension}`)
  )
    throw new BookFileValidationError('invalid-file', 'Invalid filename')
  if (basename.length <= 200) return basename
  const suffix = `.${extension}`
  return `${basename.slice(0, 200 - suffix.length)}${suffix}`
}

function validSignature(bytes: Buffer, type: BookFileType) {
  if (type === 'PDF') return bytes.subarray(0, 5).toString() === '%PDF-'
  return bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
}

function storagePath(key: string) {
  if (!/^[a-f0-9-]+\.(epub|pdf)$/.test(key))
    throw new BookFileValidationError('invalid-file', 'Invalid storage key')
  return path.join(getEnv().BOOK_FILE_STORAGE_PATH, key)
}

export async function saveBookFile(file: File, type: BookFileType) {
  const definition = definitions[type]
  if (!file.size)
    throw new BookFileValidationError('invalid-file', 'File is empty')
  if (file.size > MAX_BOOK_FILE_BYTES)
    throw new BookFileValidationError('file-too-large', 'File is too large')
  if (!definition.declaredMimes.has(file.type.toLowerCase()))
    throw new BookFileValidationError('invalid-file', 'Invalid media type')
  const originalName = normalizedName(file.name, definition.extension)
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_BOOK_FILE_BYTES)
    throw new BookFileValidationError(
      bytes.length ? 'file-too-large' : 'invalid-file',
      bytes.length ? 'File is too large' : 'File is empty',
    )
  if (!validSignature(bytes, type))
    throw new BookFileValidationError('invalid-file', 'Invalid file signature')

  const storageKey = `${randomUUID()}.${definition.extension}`
  await mkdir(getEnv().BOOK_FILE_STORAGE_PATH, { recursive: true })
  await writeFile(storagePath(storageKey), bytes, { flag: 'wx' })
  return {
    storageKey,
    originalName,
    mime: definition.mime,
    size: bytes.length,
  }
}

export async function readBookFile(key: string) {
  return readFile(storagePath(key))
}

export async function removeBookFile(key?: string | null) {
  if (!key) return
  try {
    await unlink(storagePath(key))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
