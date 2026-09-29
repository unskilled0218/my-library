import {
  addLocationAction,
  changePasswordAction,
  deleteLocationAction,
  renameLocationAction,
  updateDisplayAction,
  updateLanguageAction,
} from '@/app/actions'
import { DeleteIcon, SaveIcon } from '@/components/icons'
import { ImportPanel } from '@/components/import-panel'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getLanguage } from '@/lib/i18n/server'
import { settingsErrorKeys, settingsMessages } from '@/lib/i18n/settings'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string }>
}) {
  const user = await requireUser()
  const [{ error, status }, language, settings, locationTags] =
    await Promise.all([
      searchParams,
      getLanguage(),
      db.userDisplaySettings.findUnique({ where: { userId: user.id } }),
      db.locationTag.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      }),
    ])
  const messages = settingsMessages[language]
  const errorMessage = error
    ? messages[settingsErrorKeys[error as keyof typeof settingsErrorKeys]]
    : undefined
  const display = settings ?? {
    defaultView: 'GRID',
    showCover: true,
    showTitle: true,
    showAuthors: true,
    showGenre: true,
    showReading: true,
    showLocation: false,
  }

  return (
    <div
      id="global-settings-page"
      className="mx-auto max-w-4xl px-5 py-12 md:px-8"
    >
      <p className="eyebrow">{messages.eyebrow}</p>
      <h1 className="mt-2 font-serif text-5xl font-black">{messages.title}</h1>
      <p className="mt-3 max-w-2xl text-ink/60">{messages.intro}</p>
      {errorMessage && (
        <p
          id="settings-error"
          className="mt-6 rounded-xl bg-rust/10 p-3 text-sm text-rust"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
      {status === 'language-updated' && (
        <p
          className="mt-6 rounded-xl bg-moss/10 p-3 text-sm text-moss"
          role="status"
        >
          {messages.languageUpdated}
        </p>
      )}
      <div
        id="global-settings-list"
        data-layout="list"
        className="mt-8 space-y-6"
      >
        <section id="language-settings" className="panel">
          <p className="eyebrow">{messages.languageEyebrow}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {messages.languageTitle}
          </h2>
          <p className="mt-3 text-sm text-ink/60">{messages.languageBody}</p>
          <form
            id="language-settings-form"
            action={updateLanguageAction}
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="min-w-0 flex-1 text-sm font-semibold">
              {messages.languageLabel}
              <select
                className="mt-1"
                name="language"
                defaultValue={settings?.language ?? 'KO'}
              >
                <option value="KO">{messages.korean}</option>
                <option value="EN">{messages.english}</option>
              </select>
            </label>
            <button
              className="h-10 w-10 p-0"
              type="submit"
              aria-label={messages.saveLanguage}
            >
              <SaveIcon />
            </button>
          </form>
        </section>
        <section id="account-settings" className="panel">
          <p className="eyebrow">{messages.account}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {messages.password}
          </h2>
          <p className="mt-3 text-sm text-ink/60">
            {messages.signedInAs}{' '}
            <strong className="text-ink">{user.loginId}</strong>.{' '}
            {messages.loginImmutable}
          </p>
          <form
            id="change-password-form"
            action={changePasswordAction}
            className="mt-5 space-y-3"
          >
            <label className="block text-sm font-semibold">
              {messages.currentPassword}
              <input
                className="mt-1"
                type="password"
                name="currentPassword"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              {messages.newPassword}
              <input
                className="mt-1"
                type="password"
                name="newPassword"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              {messages.confirmPassword}
              <input
                className="mt-1"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button type="submit">{messages.changePassword}</button>
          </form>
        </section>
        <section id="library-display-settings" className="panel">
          <p className="eyebrow">{messages.display}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {messages.libraryView}
          </h2>
          <p className="mt-3 text-sm text-ink/60">{messages.displayBody}</p>
          <form
            id="display-settings-form"
            action={updateDisplayAction}
            className="mt-5 space-y-3"
          >
            <label className="block text-sm font-semibold">
              {messages.defaultLayout}
              <select
                className="mt-1"
                name="defaultView"
                defaultValue={display.defaultView}
              >
                <option value="GRID">{messages.grid}</option>
                <option value="LIST">{messages.list}</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['showCover', messages.cover],
                ['showTitle', messages.bookTitle],
                ['showAuthors', messages.authors],
                ['showGenre', messages.genre],
                ['showReading', messages.reading],
                ['showLocation', messages.location],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-2">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    name={name}
                    defaultChecked={
                      display[name as keyof typeof display] as boolean
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              className="h-10 w-10 p-0"
              type="submit"
              aria-label={messages.saveDisplay}
            >
              <SaveIcon />
            </button>
          </form>
        </section>
        <section id="shelf-tag-settings" className="panel">
          <p className="eyebrow">{messages.locations}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {messages.shelfTags}
          </h2>
          <p className="mt-3 text-sm text-ink/60">{messages.shelfBody}</p>
          <form
            id="add-shelf-tag-form"
            action={addLocationAction}
            className="mt-5 flex flex-col gap-2 sm:flex-row"
          >
            <input
              name="name"
              required
              maxLength={80}
              placeholder={messages.shelfPlaceholder}
            />
            <button className="shrink-0" type="submit">
              {messages.addShelf}
            </button>
          </form>
          <div className="mt-5 space-y-2">
            {locationTags.map((tag) => (
              <div
                id={`shelf-tag-${tag.id}`}
                key={tag.id}
                className="flex flex-col gap-2 rounded-xl bg-ink/5 p-3 sm:flex-row"
              >
                <form
                  action={renameLocationAction}
                  className="flex min-w-0 flex-1 gap-2"
                >
                  <input type="hidden" name="tagId" value={tag.id} />
                  <input
                    name="name"
                    defaultValue={tag.name}
                    maxLength={80}
                    required
                    aria-label={`${messages.rename} ${tag.name}`}
                  />
                  <button
                    className="button-secondary h-10 w-10 shrink-0 p-0"
                    type="submit"
                    aria-label={`${messages.save} ${tag.name}`}
                  >
                    <SaveIcon />
                  </button>
                </form>
                <form action={deleteLocationAction}>
                  <input type="hidden" name="tagId" value={tag.id} />
                  <button
                    className="button-secondary h-10 w-full p-0 sm:w-10"
                    type="submit"
                    aria-label={`${messages.delete} ${tag.name}`}
                  >
                    <DeleteIcon />
                  </button>
                </form>
              </div>
            ))}
            {locationTags.length === 0 && (
              <p className="text-sm text-ink/60">{messages.noShelves}</p>
            )}
          </div>
        </section>
        <section id="account-transfer-settings" className="panel">
          <p className="eyebrow">{messages.portability}</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">
            {messages.backupTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            {messages.backupBody}
          </p>
          <div className="mt-5 space-y-6">
            <div>
              <h3 className="font-serif text-xl font-bold">
                {messages.export}
              </h3>
              <a
                id="export-all-libraries"
                className="button mt-3"
                href="/api/settings/transfer"
              >
                {messages.download}
              </a>
            </div>
            <div className="border-t border-ink/10 pt-5">
              <h3 className="font-serif text-xl font-bold">
                {messages.import}
              </h3>
              <p className="mt-2 mb-4 text-sm text-ink/60">
                {messages.importBody}
              </p>
              <ImportPanel
                id="account-import-panel"
                endpoint="/api/settings/transfer"
                account
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
