// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KyoboAddBookForm } from '@/components/kyobo-add-book-form'
import type { KyoboAddResult } from '@/lib/book-options'

const addBook = vi.hoisted(() => vi.fn())
vi.mock('@/app/actions', () => ({ addKyoboBookAction: addBook }))

const props = {
  saleId: 'S000001772370',
  q: 'Dune',
  source: 'kyobo',
  language: 'EN' as const,
  selectedDestinationId: 'shared',
  destinations: [
    {
      id: 'owned',
      name: 'My library',
      locations: [{ id: 'mine', name: 'My shelf' }],
      folders: [],
    },
    {
      id: 'shared',
      name: 'Shared library',
      locations: [{ id: 'owners', name: 'Owner shelf' }],
      folders: [{ id: 'child', title: 'Child', depth: 1 }],
    },
  ],
}
afterEach(cleanup)
beforeEach(() => {
  vi.resetAllMocks()
  addBook.mockResolvedValue({ error: 'detailsUnavailable' })
})

describe('KyoboAddBookForm', () => {
  it('shows default options and only the selected library owner choices', () => {
    render(<KyoboAddBookForm {...props} />)
    expect(screen.getByLabelText('Destination library')).toHaveValue('shared')
    expect(screen.getByLabelText('Ownership')).toHaveValue('HAVE')
    expect(screen.getByLabelText('Reading state')).toHaveValue('NOT_STARTED')
    expect(screen.getByLabelText('Location')).toHaveValue('')
    expect(
      screen.getByRole('option', { name: 'Owner shelf' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'My shelf' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: '— Child' })).toBeInTheDocument()
    expect(screen.getByLabelText('Started')).toBeDisabled()
    expect(screen.getByLabelText('Finished')).toBeDisabled()
    expect(screen.getByLabelText('Rating')).toHaveValue('')
    expect(screen.getByLabelText('Personal comment')).toHaveAttribute(
      'maxlength',
      '10000',
    )
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Authors')).not.toBeInTheDocument()
  })

  it('clears destination-bound selections while retaining ownership and notes', () => {
    render(<KyoboAddBookForm {...props} />)
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'owners' },
    })
    fireEvent.change(screen.getByLabelText('Folder'), {
      target: { value: 'child' },
    })
    fireEvent.change(screen.getByLabelText('Ownership'), {
      target: { value: 'DONT_HAVE' },
    })
    fireEvent.change(screen.getByLabelText('Personal comment'), {
      target: { value: 'Keep my choices' },
    })
    fireEvent.change(screen.getByLabelText('Destination library'), {
      target: { value: 'owned' },
    })
    expect(screen.getByLabelText('Location')).toHaveValue('')
    expect(screen.getByLabelText('Folder')).toHaveValue('')
    expect(
      screen.queryByRole('option', { name: 'Owner shelf' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'My shelf' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ownership')).toHaveValue('DONT_HAVE')
    expect(screen.getByLabelText('Personal comment')).toHaveValue(
      'Keep my choices',
    )
  })

  it('keeps a usable form for empty tag/folder lists and disables ebook locations', () => {
    render(
      <KyoboAddBookForm
        {...props}
        ebook
        selectedDestinationId="owned"
        destinations={[
          { id: 'owned', name: 'Empty library', locations: [], folders: [] },
        ]}
      />,
    )
    expect(screen.getByLabelText('Location')).toBeDisabled()
    expect(screen.getByLabelText('Folder')).toHaveTextContent('Library root')
    expect(screen.getByRole('button', { name: 'Add to library' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Reading state'), {
      target: { value: 'READING' },
    })
    expect(screen.getByLabelText('Started')).toBeEnabled()
    expect(screen.getByLabelText('Finished')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Reading state'), {
      target: { value: 'DONE' },
    })
    expect(screen.getByLabelText('Finished')).toBeEnabled()
  })

  it('announces pending retrieval and freezes controls until the response, retaining inputs for retry', async () => {
    let finish!: (result: KyoboAddResult) => void
    addBook.mockReturnValueOnce(
      new Promise<KyoboAddResult>((resolve) => {
        finish = resolve
      }),
    )
    render(<KyoboAddBookForm {...props} />)
    fireEvent.change(screen.getByLabelText('Personal comment'), {
      target: { value: 'Retain notes' },
    })
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'owners' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Add to library' }).closest('form')!,
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Retrieving Kyobo information',
      ),
    )
    expect(screen.getByLabelText('Destination library')).toBeDisabled()
    expect(screen.getByLabelText('Personal comment')).toBeDisabled()
    expect(screen.getByRole('button')).toBeDisabled()
    await act(async () => {
      finish({ error: 'detailsUnavailable' })
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Book details are unavailable.',
    )
    expect(screen.getByLabelText('Personal comment')).toHaveValue(
      'Retain notes',
    )
    expect(screen.getByLabelText('Location')).toHaveValue('owners')
    expect(screen.getByRole('button')).toBeEnabled()
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    await waitFor(() => expect(addBook).toHaveBeenCalledTimes(2))
    const retry = addBook.mock.calls[1][0] as FormData
    expect(retry.get('comment')).toBe('Retain notes')
    expect(retry.get('locationTagId')).toBe('owners')
    expect(retry.get('libraryId')).toBe('shared')
    expect(retry.get('saleId')).toBe(props.saleId)
  })

  it('localizes validation errors in Korean', async () => {
    addBook.mockResolvedValue({ error: 'invalidDateOrder' })
    render(<KyoboAddBookForm {...props} language="KO" />)
    fireEvent.submit(
      screen.getByRole('button', { name: '서재에 추가' }).closest('form')!,
    )
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '다 읽은 날은 읽기 시작한 날보다 빠를 수 없습니다.',
      ),
    )
  })
})
