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
import { ImportPanel } from '@/components/import-panel'
import { LocaleProvider } from '@/components/locale-provider'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPanel(language: 'KO' | 'EN', account = false) {
  return render(
    <LocaleProvider language={language}>
      <ImportPanel libraryId="library-1" account={account} />
    </LocaleProvider>,
  )
}

function selectFile(name = 'backup.json') {
  fireEvent.change(screen.getByLabelText(/가져올 파일|File to import/), {
    target: { files: [new File(['{}'], name, { type: 'application/json' })] },
  })
}

describe('ImportPanel localization', () => {
  it('renders Korean controls and preview feedback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ books: 3, duplicates: 1, willCreate: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    renderPanel('KO')
    selectFile()

    fireEvent.click(screen.getByRole('button', { name: '가져오기 미리보기' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      '미리보기가 준비되었습니다.',
    )
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent === '3개 레코드 · 1개 중복 · 2권의 새 도서',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '가져오기 적용' })).toBeEnabled()
  })

  it('renders English controls and maps known API errors to Korean', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid or oversized file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const view = renderPanel('EN')

    expect(screen.getByLabelText('File to import')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Preview import' }),
    ).toBeDisabled()

    view.rerender(
      <LocaleProvider language="KO">
        <ImportPanel libraryId="library-1" />
      </LocaleProvider>,
    )
    selectFile()
    fireEvent.click(screen.getByRole('button', { name: '가져오기 미리보기' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '파일이 올바르지 않거나 허용 크기를 초과했습니다.',
      ),
    )
  })

  it('formats an English import result with singular counts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ books: 1, duplicates: 0, willCreate: 1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ imported: 1, skipped: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    renderPanel('EN')
    selectFile()

    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Apply import' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 1 book; skipped 0 duplicates.',
    )
  })
})
