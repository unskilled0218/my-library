'use client'

import { useState, type ChangeEvent } from 'react'
import { useBookAdds } from '@/components/book-add-provider'
import { booksMessages } from '@/lib/i18n/books'
import { commonMessages } from '@/lib/i18n/common'
import type { AppLanguage } from '@/lib/i18n/config'
import { searchMessages } from '@/lib/i18n/search'

export type KyoboDestination = {
  id: string
  name: string
  locations: { id: string; name: string }[]
  folders: { id: string; title: string; depth: number }[]
}

export function KyoboAddBookForm({
  saleId,
  q,
  source,
  destinations,
  selectedDestinationId,
  language,
  ebook = false,
  duplicate = false,
  title = '',
}: {
  saleId: string
  q: string
  source: string
  destinations: KyoboDestination[]
  selectedDestinationId?: string
  language: AppLanguage
  ebook?: boolean
  duplicate?: boolean
  title?: string
}) {
  const messages = searchMessages[language]
  const books = booksMessages[language]
  const common = commonMessages[language]
  const { tasks, submit } = useBookAdds()
  const [fields, setFields] = useState(() => {
    const defaults = {
      libraryId: destinations.some(
        (library) => library.id === selectedDestinationId,
      )
        ? selectedDestinationId!
        : (destinations[0]?.id ?? ''),
      ownershipState: 'HAVE',
      locationTagId: '',
      folderId: '',
      readingState: 'NOT_STARTED',
      readingStartedAt: '',
      readingFinishedAt: '',
      rating: '',
      comment: '',
    }
    const failed = tasks.find(
      (task) =>
        task.saleId === saleId &&
        task.state === 'error' &&
        task.libraryId === defaults.libraryId,
    )
    if (!failed) return defaults
    const restored = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof typeof defaults)[])
      restored[key] = failed.values[key] ?? defaults[key]
    const library = destinations.find(
      (entry) => entry.id === restored.libraryId,
    )
    if (!library) return defaults
    if (
      ebook ||
      !library.locations.some((entry) => entry.id === restored.locationTagId)
    )
      restored.locationTagId = ''
    if (!library.folders.some((entry) => entry.id === restored.folderId))
      restored.folderId = ''
    return restored
  })
  const destination = destinations.find(
    (library) => library.id === fields.libraryId,
  )
  const task = tasks.find(
    (entry) => entry.saleId === saleId && entry.libraryId === fields.libraryId,
  )
  const pending = task?.state === 'pending'
  const completed = task?.state === 'success' || task?.state === 'existing'
  const error =
    (task?.state === 'error' ? task.error : null) ??
    (duplicate ? 'alreadyExists' : null)
  function bind(name: keyof typeof fields) {
    return {
      name,
      value: fields[name],
      onChange: (
        event: ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) => {
        const value = event.target.value
        setFields((current) =>
          name === 'libraryId'
            ? { ...current, libraryId: value, locationTagId: '', folderId: '' }
            : { ...current, [name]: value },
        )
      },
    }
  }
  if (!destinations.length) return <p>{messages.noWritableLibrary}</p>
  return (
    <form
      id="kyobo-add-book-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!destination) return
        const form = new FormData(event.currentTarget)
        const detail = new URL(window.location.href)
        detail.searchParams.set('libraryId', destination.id)
        submit({
          saleId,
          libraryId: destination.id,
          libraryName: destination.name,
          title,
          detailHref: `${detail.pathname}${detail.search}`,
          values: Object.fromEntries(
            [...form.entries()].map(([key, value]) => [key, String(value)]),
          ),
        })
      }}
      onReset={(event) => event.preventDefault()}
      className="panel space-y-5"
    >
      <h2 className="font-serif text-2xl font-bold">
        {messages.reviewBeforeAdding}
      </h2>
      <p className="text-sm text-ink/60">{messages.fetchOnAdd}</p>
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="source" value={source} />
      {error && (
        <p id="kyobo-add-message" role="alert" className="text-sm text-rust">
          {messages[error] ?? messages.saveFailed}
        </p>
      )}
      {pending && (
        <p role="status" className="text-sm text-moss">
          {messages.addingBook}
        </p>
      )}
      <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="min-w-0 sm:col-span-2">
          {messages.destinationLibrary}
          <select
            id="kyobo-destination-library"
            {...bind('libraryId')}
            required
          >
            {destinations.map((library) => (
              <option key={library.id} value={library.id}>
                {library.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {books.ownership}
          <select {...bind('ownershipState')}>
            <option value="HAVE">{common.have}</option>
            <option value="DONT_HAVE">{common.dontHave}</option>
          </select>
        </label>
        <label>
          {books.location}
          <select {...bind('locationTagId')} disabled={ebook}>
            <option value="">{books.none}</option>
            {destination?.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {books.folder}
          <select {...bind('folderId')}>
            <option value="">{books.libraryRoot}</option>
            {destination?.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {'— '.repeat(folder.depth)}
                {folder.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {books.readingState}
          <select {...bind('readingState')}>
            <option value="NOT_STARTED">{common.notStarted}</option>
            <option value="READING">{common.reading}</option>
            <option value="DONE">{common.done}</option>
          </select>
        </label>
        <label>
          {books.started}
          <input
            type="date"
            {...bind('readingStartedAt')}
            disabled={fields.readingState === 'NOT_STARTED'}
          />
        </label>
        <label>
          {books.finished}
          <input
            type="date"
            {...bind('readingFinishedAt')}
            disabled={fields.readingState !== 'DONE'}
          />
        </label>
        <label>
          {books.rating}
          <select {...bind('rating')}>
            <option value="">{books.notRated}</option>
            {[1, 2, 3, 4, 5].map((rating) => (
              <option key={rating}>{rating}</option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          {books.personalComment}
          <textarea rows={4} maxLength={10_000} {...bind('comment')} />
        </label>
        <button
          type="submit"
          disabled={pending || completed}
          className="sm:col-span-2"
        >
          {pending
            ? messages.addingBook
            : completed
              ? task.state === 'existing'
                ? messages.alreadyExists
                : messages.bookAdded
              : messages.addToLibrary}
        </button>
      </fieldset>
    </form>
  )
}
