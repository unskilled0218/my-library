// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BookAddProvider,
  useBookAdds,
  type BookAddInput,
} from './book-add-provider'
import { LocaleProvider } from './locale-provider'
import { KyoboAddBookForm } from './kyobo-add-book-form'
import type { ReactNode } from 'react'

const navigation = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
const input: BookAddInput = {
  saleId: 'S000001772370',
  libraryId: 'library',
  libraryName: 'My library',
  title: 'First book',
  detailHref: '/search/kyobo/S000001772370?libraryId=library',
  values: {
    comment: 'Original notes',
    ownershipState: 'DONT_HAVE',
    locationTagId: 'removed',
    folderId: 'removed',
  },
}

function Controls() {
  const { submit } = useBookAdds()
  return (
    <>
      <button
        onClick={() => {
          submit(input)
          submit(input)
        }}
      >
        Add first twice
      </button>
      <button
        onClick={() =>
          submit({ ...input, saleId: 'S000001772371', title: 'Second book' })
        }
      >
        Add second
      </button>
    </>
  )
}
function Shell({
  children,
  userId = 'user',
  language = 'EN',
}: {
  children?: ReactNode
  userId?: string | null
  language?: 'EN' | 'KO'
}) {
  return (
    <LocaleProvider language={language}>
      <BookAddProvider userId={userId}>{children}</BookAddProvider>
    </LocaleProvider>
  )
}
function deferred() {
  let resolve!: (value: unknown) => void
  let reject!: (error: Error) => void
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const response = (result: unknown) => ({ json: async () => result })
const panel = () =>
  within(document.querySelector('#book-add-status') as HTMLElement)

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('background book additions', () => {
  it('guards rapid submits, survives page unmount and collapse, and completes different books out of order', async () => {
    const first = deferred(),
      second = deferred()
    const fetch = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    vi.stubGlobal('fetch', fetch)
    const view = render(
      <Shell>
        <Controls />
      </Shell>,
    )
    fireEvent.click(screen.getByText('Add first twice'))
    fireEvent.click(screen.getByText('Add second'))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(
      panel().getByRole('button', { name: /Book additions/ }),
    ).toHaveTextContent('Active: 2')
    fireEvent.click(panel().getByRole('button', { name: /Book additions/ }))
    view.rerender(
      <Shell>
        <input aria-label="Other work" />
      </Shell>,
    )
    const other = screen.getByLabelText('Other work')
    other.focus()
    fireEvent.change(other, { target: { value: 'Keep working' } })
    await act(async () =>
      second.resolve(
        response({ status: 'created', bookId: 'second', libraryId: 'library' }),
      ),
    )
    expect(other).toHaveFocus()
    expect(
      panel().getByRole('button', { name: /Book additions/ }),
    ).toHaveTextContent('Active: 1')
    fireEvent.click(panel().getByRole('button', { name: /Book additions/ }))
    expect(
      panel().getByRole('link', { name: 'View and edit book' }),
    ).toHaveAttribute('href', '/books/second')
    expect(panel().getByText('First book').closest('article')).toHaveAttribute(
      'data-task-state',
      'pending',
    )
    await act(async () =>
      first.resolve(
        response({ status: 'created', bookId: 'first', libraryId: 'library' }),
      ),
    )
    expect(panel().getAllByText('Book added')).toHaveLength(2)
    expect(navigation.refresh).toHaveBeenCalledTimes(2)
    expect(navigation.push).not.toHaveBeenCalled()
    expect(other).toHaveValue('Keep working')
  })

  it('retains the snapshot after response loss and resolves explicit retry to a non-retryable existing book', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Lost response'))
      .mockResolvedValueOnce(
        response({ status: 'existing', bookId: 'saved', libraryId: 'library' }),
      )
    vi.stubGlobal('fetch', fetch)
    render(
      <Shell>
        <Controls />
      </Shell>,
    )
    fireEvent.click(screen.getByText('Add first twice'))
    await waitFor(() =>
      expect(panel().getByRole('alert')).toHaveTextContent(
        'outcome is unknown',
      ),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
    fireEvent.click(panel().getByRole('button', { name: 'Retry addition' }))
    await waitFor(() =>
      expect(
        panel().getByRole('link', { name: 'View and edit book' }),
      ).toHaveAttribute('href', '/books/saved'),
    )
    expect(
      panel().queryByRole('button', { name: 'Retry addition' }),
    ).not.toBeInTheDocument()
    expect(
      panel().getByText(/Options from this request were not applied/),
    ).toBeVisible()
    expect((fetch.mock.calls[1][1].body as FormData).get('comment')).toBe(
      'Original notes',
    )
    expect((fetch.mock.calls[1][1].body as FormData).get('libraryId')).toBe(
      'library',
    )
    fireEvent.click(screen.getByText('Add first twice'))
    expect(fetch).toHaveBeenCalledTimes(2)
    fireEvent.click(panel().getByRole('button', { name: 'Dismiss' }))
    expect(document.querySelector('#book-add-status')).toBeNull()
  })

  it('clears old identity tasks and ignores their late completion', async () => {
    const pending = deferred()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise))
    const view = render(
      <Shell>
        <Controls />
      </Shell>,
    )
    fireEvent.click(screen.getByText('Add first twice'))
    view.rerender(
      <Shell userId="another">
        <Controls />
      </Shell>,
    )
    expect(document.querySelector('#book-add-status')).toBeNull()
    await act(async () =>
      pending.resolve(
        response({
          status: 'created',
          bookId: 'private',
          libraryId: 'library',
        }),
      ),
    )
    expect(document.querySelector('#book-add-status')).toBeNull()
    expect(navigation.refresh).not.toHaveBeenCalled()
  })

  it('restores failed form values after navigation and reconciles removed shelf/folder choices', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ status: 'error', error: 'detailsUnavailable' }),
        ),
    )
    const view = render(
      <Shell>
        <Controls />
      </Shell>,
    )
    fireEvent.click(screen.getByText('Add first twice'))
    await waitFor(() =>
      expect(panel().getByRole('alert')).toHaveTextContent(
        'details are unavailable',
      ),
    )
    expect(panel().getByRole('link', { name: 'Edit options' })).toHaveAttribute(
      'href',
      input.detailHref,
    )
    view.rerender(
      <Shell>
        <KyoboAddBookForm
          saleId={input.saleId}
          language="EN"
          q=""
          source="kyobo"
          selectedDestinationId="library"
          destinations={[
            { id: 'library', name: 'My library', locations: [], folders: [] },
          ]}
        />
      </Shell>,
    )
    expect(screen.getByLabelText('Personal comment')).toHaveValue(
      'Original notes',
    )
    expect(screen.getByLabelText('Ownership')).toHaveValue('DONT_HAVE')
    expect(screen.getByLabelText('Location')).toHaveValue('')
    expect(screen.getByLabelText('Folder')).toHaveValue('')
  })

  it('offers sign-in instead of retry on an expired session and localizes the panel', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ status: 'error', error: 'signInRequired' }),
        ),
    )
    render(
      <Shell language="KO">
        <Controls />
      </Shell>,
    )
    fireEvent.click(screen.getByText('Add first twice'))
    await waitFor(() =>
      expect(panel().getByRole('alert')).toHaveTextContent(
        '로그인이 필요합니다.',
      ),
    )
    expect(
      panel().getByRole('link', { name: '로그인하고 이 책 추가' }),
    ).toHaveAttribute('href', '/login')
    expect(
      panel().queryByRole('button', { name: '다시 추가' }),
    ).not.toBeInTheDocument()
  })

  it('treats malformed success data as uncertain instead of showing a saved book', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          status: 'created',
          libraryId: 'foreign',
          bookId: 'hidden',
        }),
      ),
    )
    render(
      <Shell>
        <Controls />
      </Shell>,
    )
    fireEvent.click(screen.getByText('Add first twice'))
    await waitFor(() =>
      expect(panel().getByRole('alert')).toHaveTextContent(
        'outcome is unknown',
      ),
    )
    expect(
      panel().queryByRole('link', { name: 'View and edit book' }),
    ).not.toBeInTheDocument()
    expect(navigation.refresh).not.toHaveBeenCalled()
  })
})
