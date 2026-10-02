// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookFilesPanel } from '@/components/book-files-panel'
import { LocaleProvider } from '@/components/locale-provider'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  refresh.mockReset()
  vi.unstubAllGlobals()
})

describe('BookFilesPanel', () => {
  it('gives readers downloads without mutation controls', () => {
    render(
      <LocaleProvider language="EN">
        <BookFilesPanel
          bookId="book-1"
          files={[
            { type: 'PDF', originalName: 'manual.pdf', size: 1024 * 1024 },
          ]}
          canWrite={false}
        />
      </LocaleProvider>,
    )

    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      '/api/books/book-1/files/PDF',
    )
    expect(screen.getByText('1 MB')).toBeInTheDocument()
    expect(screen.queryByLabelText('Choose PDF file')).not.toBeInTheDocument()
    expect(screen.getAllByText('No file uploaded.')).toHaveLength(1)
  })

  it('uploads into an independent writable slot and reports success', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ uploaded: true, replaced: false }),
    })
    vi.stubGlobal('fetch', fetch)
    render(
      <LocaleProvider language="KO">
        <BookFilesPanel bookId="book-1" files={[]} canWrite />
      </LocaleProvider>,
    )

    const input = screen.getByLabelText('EPUB 파일 선택')
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'book.epub', {
            type: 'application/epub+zip',
          }),
        ],
      },
    })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() =>
      expect(screen.getByText('파일을 업로드했습니다.')).toBeInTheDocument(),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/books/book-1/files/EPUB',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(refresh).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('PDF 파일 선택')).toBeInTheDocument()
  })
})
