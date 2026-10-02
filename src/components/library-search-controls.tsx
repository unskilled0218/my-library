'use client'

import { useState } from 'react'
import { CloseIcon, FilterIcon } from '@/components/icons'
import { useLanguage } from '@/components/locale-provider'
import { commonMessages } from '@/lib/i18n/common'
import { librariesMessages } from '@/lib/i18n/libraries'

type Option = {
  id: string
  name: string
}

type SearchQuery = {
  folder?: string
  q?: string
  reading?: string
  format?: string
  ownership?: string
  location?: string
  genre?: string
}

export function LibrarySearchControls({
  query,
  locations,
  genres,
}: {
  query: SearchQuery
  locations: Option[]
  genres: Option[]
}) {
  const [filtersVisible, setFiltersVisible] = useState(false)
  const language = useLanguage()
  const messages = librariesMessages[language]
  const common = commonMessages[language]

  return (
    <form id="library-filters" className="panel mt-8">
      {query.folder && (
        <input type="hidden" name="folder" value={query.folder} />
      )}
      <div id="library-search-row" className="flex items-center gap-2">
        <input
          id="library-search-input"
          className="min-w-0 flex-1"
          name="q"
          defaultValue={query.q}
          placeholder={messages.searchPlaceholder}
          aria-label={messages.searchBooks}
        />
        <div className="flex shrink-0 gap-2">
          <button id="library-search-button" type="submit">
            {common.search}
          </button>
          <button
            id="library-filter-toggle"
            className="button-secondary h-10 w-10 p-0"
            type="button"
            aria-label={messages.filter}
            aria-expanded={filtersVisible}
            aria-controls="library-filter-panel"
            onClick={() => setFiltersVisible(true)}
          >
            <FilterIcon />
          </button>
        </div>
      </div>
      <div
        id="library-filter-panel"
        className={`mt-4 gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2 lg:grid-cols-4 ${filtersVisible ? 'grid' : 'hidden'}`}
        hidden={!filtersVisible}
      >
        <select
          name="reading"
          defaultValue={query.reading ?? ''}
          aria-label={messages.readingState}
        >
          <option value="">{messages.allReadingStates}</option>
          <option value="NOT_STARTED">{common.notStarted}</option>
          <option value="READING">{common.reading}</option>
          <option value="DONE">{common.done}</option>
        </select>
        <select
          name="format"
          defaultValue={query.format ?? ''}
          aria-label={messages.format}
        >
          <option value="">{messages.allFormats}</option>
          <option value="PHYSICAL">{common.physical}</option>
          <option value="EBOOK">{common.ebook}</option>
        </select>
        <select
          name="ownership"
          defaultValue={query.ownership ?? ''}
          aria-label={messages.ownership}
        >
          <option value="">{messages.allOwnership}</option>
          <option value="HAVE">{common.have}</option>
          <option value="DONT_HAVE">{common.dontHave}</option>
        </select>
        <select
          name="location"
          defaultValue={query.location ?? ''}
          aria-label={messages.location}
        >
          <option value="">{messages.allLocations}</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <select
          name="genre"
          defaultValue={query.genre ?? ''}
          aria-label={messages.genre}
        >
          <option value="">{messages.allGenres}</option>
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>
        <button
          id="library-hide-filters"
          className="button-secondary h-12 w-12 p-0 sm:col-span-2 sm:justify-self-end lg:col-span-4"
          type="button"
          aria-label={messages.hideFilters}
          onClick={() => setFiltersVisible(false)}
        >
          <CloseIcon />
        </button>
      </div>
    </form>
  )
}
