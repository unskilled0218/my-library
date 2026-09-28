'use client'

import { useState } from 'react'

type Option = {
  id: string
  name: string
}

type SearchQuery = {
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

  return (
    <form id="library-filters" className="panel mt-8">
      <div id="library-search-row" className="flex items-center gap-2">
        <input
          id="library-search-input"
          className="min-w-0 flex-1"
          name="q"
          defaultValue={query.q}
          placeholder="Search title, author, genre, ISBN, notes..."
          aria-label="Search books"
        />
        <div className="flex shrink-0 gap-2">
          <button id="library-search-button" type="submit">
            Search
          </button>
          <button
            id="library-filter-toggle"
            className="button-secondary"
            type="button"
            aria-expanded={filtersVisible}
            aria-controls="library-filter-panel"
            onClick={() => setFiltersVisible(true)}
          >
            Filter
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
          aria-label="Reading state"
        >
          <option value="">All reading states</option>
          <option value="NOT_STARTED">Not started</option>
          <option value="READING">Reading</option>
          <option value="DONE">Done</option>
        </select>
        <select
          name="format"
          defaultValue={query.format ?? ''}
          aria-label="Format"
        >
          <option value="">All formats</option>
          <option value="PHYSICAL">Physical</option>
          <option value="EBOOK">Ebook</option>
        </select>
        <select
          name="ownership"
          defaultValue={query.ownership ?? ''}
          aria-label="Ownership"
        >
          <option value="">All ownership</option>
          <option value="HAVE">Have</option>
          <option value="DONT_HAVE">Do not have</option>
        </select>
        <select
          name="location"
          defaultValue={query.location ?? ''}
          aria-label="Location"
        >
          <option value="">All locations</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <select
          name="genre"
          defaultValue={query.genre ?? ''}
          aria-label="Genre"
        >
          <option value="">All genres</option>
          {genres.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>
        <button
          id="library-hide-filters"
          className="button-secondary sm:col-span-2 lg:col-span-4 lg:justify-self-end"
          type="button"
          onClick={() => setFiltersVisible(false)}
        >
          Hide filters
        </button>
      </div>
    </form>
  )
}
