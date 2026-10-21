'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { KyoboRequestResult } from '@/lib/book-options'
import { BookAddStatus } from '@/components/book-add-status'

export type BookAddInput = {
  saleId: string
  libraryId: string
  libraryName: string
  title: string
  detailHref: string
  values: Record<string, string>
}
export type BookAddTask = BookAddInput & {
  id: string
  state: 'pending' | 'success' | 'existing' | 'error'
  bookId?: string
  error?:
    Extract<KyoboRequestResult, { status: 'error' }>['error'] | 'outcomeUnknown'
}
export type BookAddContextValue = {
  tasks: BookAddTask[]
  submit: (input: BookAddInput) => void
  retry: (id: string) => void
  dismiss: (id: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}
const Context = createContext<BookAddContextValue | null>(null)

export function BookAddProvider({
  userId,
  children,
}: {
  userId: string | null
  children: ReactNode
}) {
  return (
    <BookAddSession key={userId ?? 'guest'} userId={userId}>
      {children}
    </BookAddSession>
  )
}

function BookAddSession({
  userId,
  children,
}: {
  userId: string | null
  children: ReactNode
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState<BookAddTask[]>([])
  const current = useRef<BookAddTask[]>([])
  const active = useRef(true)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  function publish(next: BookAddTask[]) {
    current.current = next
    setTasks(next)
  }

  async function run(task: BookAddTask) {
    let result: KyoboRequestResult
    try {
      const form = new FormData()
      for (const [key, value] of Object.entries(task.values))
        form.set(key, value)
      const response = await fetch('/api/books/kyobo', {
        method: 'POST',
        body: form,
      })
      result = await response.json()
      if (
        !result ||
        !['created', 'existing', 'error'].includes(result.status) ||
        (result.status !== 'error' &&
          (!result.bookId || result.libraryId !== task.libraryId)) ||
        (result.status === 'error' && typeof result.error !== 'string')
      )
        throw new Error('Invalid response')
    } catch {
      if (active.current)
        publish(
          current.current.map((entry) =>
            entry.id === task.id
              ? { ...entry, state: 'error', error: 'outcomeUnknown' }
              : entry,
          ),
        )
      return
    }
    if (!active.current) return
    publish(
      current.current.map((entry) =>
        entry.id !== task.id
          ? entry
          : result.status === 'error'
            ? { ...entry, state: 'error', error: result.error }
            : {
                ...entry,
                state: result.status === 'created' ? 'success' : 'existing',
                bookId: result.bookId,
                error: undefined,
              },
      ),
    )
    if (result.status !== 'error') router.refresh()
  }

  function submit(input: BookAddInput) {
    if (!userId) return
    const previous = current.current.find(
      (task) =>
        task.saleId === input.saleId && task.libraryId === input.libraryId,
    )
    setOpen(true)
    if (previous && previous.state !== 'error') return
    const task: BookAddTask = {
      ...input,
      values: {
        ...input.values,
        saleId: input.saleId,
        libraryId: input.libraryId,
      },
      id: crypto.randomUUID(),
      state: 'pending',
    }
    publish([
      ...current.current.filter((entry) => entry.id !== previous?.id),
      task,
    ])
    void run(task)
  }

  function retry(id: string) {
    const task = current.current.find((entry) => entry.id === id)
    if (task?.state === 'error' && task.error !== 'signInRequired') submit(task)
  }

  function dismiss(id: string) {
    publish(
      current.current.filter(
        (task) => task.id !== id || task.state === 'pending',
      ),
    )
  }

  return (
    <Context.Provider value={{ tasks, submit, retry, dismiss, open, setOpen }}>
      {children}
      {userId && tasks.length > 0 && (
        <div
          aria-hidden="true"
          className={
            open ? 'h-[calc(35dvh+6rem)] md:h-[calc(50dvh+6rem)]' : 'h-28'
          }
        />
      )}
      {userId && (
        <BookAddStatus
          tasks={tasks}
          open={open}
          setOpen={setOpen}
          retry={retry}
          dismiss={dismiss}
        />
      )}
    </Context.Provider>
  )
}

export function useBookAdds() {
  const context = useContext(Context)
  if (!context) throw new Error('BookAddProvider is missing')
  return context
}
