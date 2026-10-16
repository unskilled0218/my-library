import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireLibraryAccess: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/access', () => ({
  requireLibraryAccess: mocks.requireLibraryAccess,
}))
vi.mock('@/lib/db', () => ({
  db: { library: { create: mocks.create, update: mocks.update } },
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import { createLibraryAction, updateLibraryAction } from '@/app/actions'

function libraryForm() {
  const form = new FormData()
  form.set('libraryId', 'library-1')
  form.set('name', 'New name')
  form.set('description', 'New description')
  return form
}

describe('library list mutation invalidation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 'user-1' })
    mocks.requireLibraryAccess.mockResolvedValue('OWNER')
    mocks.create.mockResolvedValue({ id: 'library-1' })
    mocks.update.mockResolvedValue({ id: 'library-1' })
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`)
    })
  })

  it('creates an owned library and refreshes both lists before the detail redirect', async () => {
    await expect(createLibraryAction(libraryForm())).rejects.toThrow(
      'REDIRECT:/libraries/library-1',
    )

    expect(mocks.create).toHaveBeenCalledWith({
      data: {
        ownerId: 'user-1',
        name: 'New name',
        description: 'New description',
      },
    })
    expect(mocks.revalidatePath.mock.calls).toEqual([['/libraries'], ['/']])
    expect(mocks.revalidatePath.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.redirect.mock.invocationCallOrder[0],
    )
  })

  it('refreshes both lists and existing detail/settings pages after an owner update', async () => {
    await updateLibraryAction(libraryForm())

    expect(mocks.requireLibraryAccess).toHaveBeenCalledWith(
      { id: 'user-1' },
      'library-1',
      'OWNER',
    )
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'library-1' },
      data: { name: 'New name', description: 'New description' },
    })
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ['/libraries/library-1'],
      ['/libraries/library-1/settings'],
      ['/libraries'],
      ['/'],
    ])
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it.each([createLibraryAction, updateLibraryAction])(
    'rejects signed-out mutations before writing or invalidating',
    async (action) => {
      mocks.requireUser.mockRejectedValue(new Error('REDIRECT:/login'))

      await expect(action(libraryForm())).rejects.toThrow('REDIRECT:/login')

      expect(mocks.create).not.toHaveBeenCalled()
      expect(mocks.update).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
    },
  )

  it('does not update or invalidate when owner access is denied', async () => {
    mocks.requireLibraryAccess.mockRejectedValue(new Error('Access denied'))

    await expect(updateLibraryAction(libraryForm())).rejects.toThrow(
      'Access denied',
    )

    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects an empty name before creating or invalidating', async () => {
    const form = libraryForm()
    form.set('name', ' ')

    await expect(createLibraryAction(form)).rejects.toThrow(
      'Library name is required',
    )

    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
