import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BookFileValidationError,
  MAX_BOOK_FILE_BYTES,
  readBookFile,
  removeBookFile,
  saveBookFile,
} from '@/lib/book-files'

describe('book file storage', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'my-library-book-files-'))
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
    vi.stubEnv('SESSION_SECRET', 'test-session-secret-at-least-32-characters')
    vi.stubEnv('BOOK_FILE_STORAGE_PATH', directory)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  })

  it('stores, reads, and removes validated PDF and EPUB files', async () => {
    const pdf = new File([Buffer.from('%PDF-1.7\ncontent')], '../manual.pdf', {
      type: 'application/pdf',
    })
    const epub = new File(
      [Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])],
      'novel.epub',
      { type: 'application/epub+zip' },
    )

    const savedPdf = await saveBookFile(pdf, 'PDF')
    const savedEpub = await saveBookFile(epub, 'EPUB')

    expect(savedPdf.originalName).toBe('manual.pdf')
    expect(savedPdf.mime).toBe('application/pdf')
    expect(savedPdf.storageKey).toMatch(/\.pdf$/)
    expect(savedEpub.storageKey).toMatch(/\.epub$/)
    expect((await readBookFile(savedPdf.storageKey)).toString()).toContain(
      '%PDF-',
    )

    await removeBookFile(savedPdf.storageKey)
    await removeBookFile(savedPdf.storageKey)
    await expect(readBookFile(savedPdf.storageKey)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it.each([
    [new File([], 'empty.pdf', { type: 'application/pdf' }), 'PDF'],
    [new File(['not pdf'], 'bad.pdf', { type: 'application/pdf' }), 'PDF'],
    [new File(['%PDF-1.7'], 'bad.epub', { type: 'application/pdf' }), 'EPUB'],
    [new File(['%PDF-1.7'], 'bad.txt', { type: 'application/pdf' }), 'PDF'],
    [
      new File(['%PDF-1.7'], 'bad\u0000.pdf', { type: 'application/pdf' }),
      'PDF',
    ],
  ] as const)('rejects invalid file %#', async (file, type) => {
    await expect(saveBookFile(file, type)).rejects.toBeInstanceOf(
      BookFileValidationError,
    )
  })

  it('rejects an oversized file before reading its bytes', async () => {
    const declared = new File(['%PDF-1.7'], 'large.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(declared, 'size', {
      value: MAX_BOOK_FILE_BYTES + 1,
    })

    await expect(saveBookFile(declared, 'PDF')).rejects.toMatchObject({
      code: 'file-too-large',
    })
  })

  it('rejects invalid storage keys before reading or removal', async () => {
    await expect(readBookFile('../secret.pdf')).rejects.toBeInstanceOf(
      BookFileValidationError,
    )
    await expect(removeBookFile('/tmp/secret.epub')).rejects.toBeInstanceOf(
      BookFileValidationError,
    )
  })
})
