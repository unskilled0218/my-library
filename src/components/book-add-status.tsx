'use client'

import Link from 'next/link'
import type { BookAddContextValue } from '@/components/book-add-provider'
import { useLanguage } from '@/components/locale-provider'
import { searchMessages } from '@/lib/i18n/search'

export function BookAddStatus({
  tasks,
  open,
  setOpen,
  retry,
  dismiss,
}: Omit<BookAddContextValue, 'submit'>) {
  const messages = searchMessages[useLanguage()]
  if (!tasks.length) return null
  const pending = tasks.filter((task) => task.state === 'pending').length
  const status = (task: (typeof tasks)[number]) =>
    task.state === 'pending'
      ? messages.addingBook
      : task.state === 'success'
        ? messages.bookAdded
        : task.state === 'existing'
          ? messages.alreadyExists
          : (messages[task.error ?? 'saveFailed'] ?? messages.saveFailed)
  return (
    <aside
      id="book-add-status"
      aria-label={messages.backgroundAdds}
      className="fixed bottom-3 right-3 z-40 w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-ink/20 bg-paper p-3 shadow-card"
    >
      <button
        type="button"
        className="w-full"
        aria-expanded={open}
        aria-controls="book-add-tasks"
        onClick={() => setOpen(!open)}
      >
        {messages.backgroundAdds} · {messages.activeAdds}: {pending}
      </button>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {tasks
          .map(
            (task) => `${task.title || messages.kyoboDetails}: ${status(task)}`,
          )
          .join(' ')}
      </div>
      <div
        id="book-add-tasks"
        hidden={!open}
        className="mt-3 max-h-[35dvh] space-y-3 overflow-y-auto overscroll-contain md:max-h-[50dvh]"
      >
        {tasks.map((task) => (
          <article
            key={task.id}
            data-task-state={task.state}
            className="space-y-2 rounded-xl border border-ink/10 bg-white p-3 text-sm"
          >
            <p className="break-words font-bold">
              {task.title || `${messages.kyoboDetails} (${task.saleId})`}
            </p>
            <p className="break-words">{task.libraryName}</p>
            <p
              role={task.state === 'error' ? 'alert' : undefined}
              className="break-words"
            >
              {task.state === 'pending' && (
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-moss border-t-transparent motion-reduce:animate-none"
                />
              )}
              {status(task)}
            </p>
            {task.state === 'existing' && (
              <p>{messages.retryOptionsNotApplied}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {task.state === 'error' &&
                (task.error === 'signInRequired' ? (
                  <Link className="button" href="/login">
                    {messages.signInToAdd}
                  </Link>
                ) : (
                  <>
                    <button type="button" onClick={() => retry(task.id)}>
                      {messages.retryAdd}
                    </button>
                    <Link
                      className="button button-secondary"
                      href={task.detailHref}
                      onClick={() => setOpen(false)}
                    >
                      {messages.editAdd}
                    </Link>
                  </>
                ))}
              {task.bookId && (
                <>
                  <Link
                    className="button"
                    href={`/books/${task.bookId}`}
                    onClick={() => setOpen(false)}
                  >
                    {messages.viewEditBook}
                  </Link>
                  <Link
                    className="button button-secondary"
                    href={`/libraries/${task.libraryId}`}
                    onClick={() => setOpen(false)}
                  >
                    {messages.goToLibrary}
                  </Link>
                </>
              )}
              {task.state !== 'pending' && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => dismiss(task.id)}
                >
                  {messages.dismiss}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </aside>
  )
}
