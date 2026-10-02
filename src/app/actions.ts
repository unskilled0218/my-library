'use server'

import { randomBytes } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import {
  Language,
  ActorType,
  BookFormat,
  LibraryView,
  MemberRole,
  OwnershipState,
  ReadingState,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireBookAccess, requireLibraryAccess } from '@/lib/access'
import { passwordChangeError } from '@/lib/account'
import {
  currentAdmin,
  requireAdmin,
  requireUser,
  signInAdmin,
  signInUser,
  signOut,
  tokenHash,
  createUser,
} from '@/lib/auth'
import { downloadCover, removeCover } from '@/lib/covers'
import { removeBookFile } from '@/lib/book-files'
import { db } from '@/lib/db'
import { upsertGenrePaths } from '@/lib/genres'
import { getKyoboBook } from '@/lib/kyobo'
import { setLanguageCookie } from '@/lib/i18n/cookie'
import { assertRateLimit } from '@/lib/rate-limit'
import {
  kyoboBookUrlSchema,
  loginIdSchema,
  passwordSchema,
} from '@/lib/validation'

const value = (form: FormData, key: string) =>
  String(form.get(key) ?? '').trim()

async function removeBookFiles(keys: string[]) {
  await Promise.all(
    keys.map((key) =>
      removeBookFile(key).catch((error) =>
        console.error('Book file cleanup failed', error),
      ),
    ),
  )
}

export async function registerAction(form: FormData) {
  const loginId = value(form, 'loginId')
  if (!loginIdSchema.safeParse(loginId).success)
    redirect('/register?error=invalid-login-id')
  if (!passwordSchema.safeParse(value(form, 'password')).success)
    redirect('/register?error=invalid-password')
  assertRateLimit(`register:${loginId}`)
  try {
    await createUser(loginId, value(form, 'password'))
    await signInUser(loginId, value(form, 'password'))
  } catch {
    redirect('/register?error=registration-failed')
  }
  redirect('/libraries')
}

export async function userLoginAction(form: FormData) {
  const loginId = value(form, 'loginId')
  assertRateLimit(`user-login:${loginId}`)
  try {
    await signInUser(loginId, value(form, 'password'))
  } catch {
    redirect('/login?error=invalid-credentials')
  }
  redirect('/libraries')
}

export async function adminLoginAction(form: FormData) {
  const loginId = value(form, 'loginId')
  assertRateLimit(`admin-login:${loginId}`)
  try {
    await signInAdmin(loginId, value(form, 'password'))
  } catch {
    redirect('/admin/login?error=invalid-credentials')
  }
  redirect('/admin')
}

export async function logoutAction() {
  await signOut('user')
  redirect('/')
}

export async function adminLogoutAction() {
  await signOut('admin')
  redirect('/admin/login')
}

export async function changePasswordAction(form: FormData) {
  const user = await requireUser()
  const currentPassword = value(form, 'currentPassword')
  const newPassword = value(form, 'newPassword')
  const confirmation = value(form, 'confirmPassword')
  assertRateLimit(`password-change:${user.id}`, 5, 10 * 60_000)
  const inputError = passwordChangeError({
    currentMatches: true,
    newMatchesCurrent: false,
    newPassword,
    confirmation,
  })
  if (inputError) redirect(`/settings?error=${encodeURIComponent(inputError)}`)
  const error = passwordChangeError({
    currentMatches: await compare(currentPassword, user.passwordHash),
    newMatchesCurrent: await compare(newPassword, user.passwordHash),
    newPassword,
    confirmation,
  })
  if (error) redirect(`/settings?error=${encodeURIComponent(error)}`)
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(newPassword, 12) },
    }),
    db.userSession.deleteMany({ where: { userId: user.id } }),
  ])
  await signOut('user')
  redirect('/login?success=password-changed')
}

export async function setupAdminAction(form: FormData) {
  const rawToken = value(form, 'token')
  const loginId = loginIdSchema.parse(value(form, 'loginId'))
  const password = passwordSchema.parse(value(form, 'password'))
  assertRateLimit(`admin-setup:${loginId}`, 5, 10 * 60_000)
  const setup = await db.adminSetupToken.findUnique({
    where: { id: 'initial' },
  })
  if (
    (await db.admin.count()) > 0 ||
    !setup ||
    setup.expiresAt <= new Date() ||
    setup.tokenHash !== tokenHash(rawToken)
  ) {
    redirect('/admin/setup?error=invalid-setup-token')
  }
  await db.$transaction(async (tx) => {
    if ((await tx.admin.count()) > 0)
      throw new Error('Administrator already exists')
    const admin = await tx.admin.create({
      data: { loginId, passwordHash: await hash(password, 12) },
    })
    await tx.adminSetupToken.deleteMany()
    await tx.auditLog.create({
      data: {
        actorType: ActorType.ADMIN,
        actorId: admin.id,
        action: 'ADMIN_CREATED',
        targetType: 'Admin',
        targetId: admin.id,
        summary: { loginId },
      },
    })
  })
  await signInAdmin(loginId, password)
  redirect('/admin')
}

export async function createLibraryAction(form: FormData) {
  const user = await requireUser()
  const name = value(form, 'name').slice(0, 100)
  if (!name) throw new Error('Library name is required')
  const library = await db.library.create({
    data: {
      ownerId: user.id,
      name,
      description: value(form, 'description').slice(0, 500),
    },
  })
  revalidatePath('/libraries')
  redirect(`/libraries/${library.id}`)
}

export async function updateLibraryAction(form: FormData) {
  const user = await requireUser()
  const libraryId = value(form, 'libraryId')
  await requireLibraryAccess(user, libraryId, 'OWNER')
  await db.library.update({
    where: { id: libraryId },
    data: {
      name: value(form, 'name').slice(0, 100),
      description: value(form, 'description').slice(0, 500),
    },
  })
  revalidatePath(`/libraries/${libraryId}`)
  revalidatePath(`/libraries/${libraryId}/settings`)
  revalidatePath('/libraries')
}

export async function deleteLibraryAction(form: FormData) {
  const user = await requireUser()
  const libraryId = value(form, 'libraryId')
  await requireLibraryAccess(user, libraryId, 'OWNER')
  const books = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Book" WHERE "libraryId" = ${libraryId} FOR UPDATE`
    const deleting = await tx.book.findMany({
      where: { libraryId },
      select: { coverKey: true, files: { select: { storageKey: true } } },
    })
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: user.id,
        action: 'LIBRARY_DELETED',
        targetType: 'Library',
        targetId: libraryId,
        libraryId,
        summary: {},
      },
    })
    await tx.library.delete({ where: { id: libraryId } })
    return deleting
  })
  await Promise.all(books.map((book) => removeCover(book.coverKey)))
  await removeBookFiles(
    books.flatMap((book) => book.files.map((file) => file.storageKey)),
  )
  redirect('/libraries')
}

export async function shareLibraryAction(form: FormData) {
  const user = await requireUser()
  const libraryId = value(form, 'libraryId')
  await requireLibraryAccess(user, libraryId, 'OWNER')
  const member = await db.user.findUnique({
    where: { loginId: loginIdSchema.parse(value(form, 'loginId')) },
  })
  if (!member || member.id === user.id) throw new Error('User cannot be added')
  const role =
    value(form, 'role') === 'EDITOR' ? MemberRole.EDITOR : MemberRole.VIEWER
  await db.$transaction([
    db.libraryMember.upsert({
      where: { libraryId_userId: { libraryId, userId: member.id } },
      update: { role },
      create: { libraryId, userId: member.id, role },
    }),
    db.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: user.id,
        action: 'MEMBER_UPSERTED',
        targetType: 'User',
        targetId: member.id,
        libraryId,
        summary: { role },
      },
    }),
  ])
  revalidatePath(`/libraries/${libraryId}`)
  revalidatePath(`/libraries/${libraryId}/settings`)
}

export async function removeMemberAction(form: FormData) {
  const user = await requireUser()
  const libraryId = value(form, 'libraryId')
  const memberId = value(form, 'memberId')
  await requireLibraryAccess(user, libraryId, 'OWNER')
  await db.$transaction([
    db.libraryMember.delete({
      where: { libraryId_userId: { libraryId, userId: memberId } },
    }),
    db.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: user.id,
        action: 'MEMBER_REMOVED',
        targetType: 'User',
        targetId: memberId,
        libraryId,
        summary: {},
      },
    }),
  ])
  revalidatePath(`/libraries/${libraryId}`)
  revalidatePath(`/libraries/${libraryId}/settings`)
}

export async function addLocationAction(form: FormData) {
  const user = await requireUser()
  const name = value(form, 'name').slice(0, 80)
  if (!name) throw new Error('Shelf tag name is required')
  if (
    await db.locationTag.findUnique({
      where: { userId_name: { userId: user.id, name } },
    })
  )
    throw new Error('Shelf tag already exists')
  await db.locationTag.create({
    data: { userId: user.id, name },
  })
  revalidatePath('/settings')
  revalidatePath('/libraries', 'layout')
}

export async function deleteLocationAction(form: FormData) {
  const user = await requireUser()
  const tagId = value(form, 'tagId')
  const tag = await db.locationTag.findFirst({
    where: { id: tagId, userId: user.id },
  })
  if (!tag) throw new Error('Shelf tag not found')
  if ((await db.book.count({ where: { locationTagId: tagId } })) > 0)
    throw new Error('Location is still in use')
  await db.locationTag.delete({ where: { id: tagId } })
  revalidatePath('/settings')
  revalidatePath('/libraries', 'layout')
}

export async function renameLocationAction(form: FormData) {
  const user = await requireUser()
  const tagId = value(form, 'tagId')
  const name = value(form, 'name').slice(0, 80)
  if (!name) throw new Error('Shelf tag name is required')
  const tag = await db.locationTag.findFirst({
    where: { id: tagId, userId: user.id },
  })
  if (!tag) throw new Error('Shelf tag not found')
  if (
    await db.locationTag.findFirst({
      where: { userId: user.id, name, id: { not: tagId } },
    })
  )
    throw new Error('Shelf tag already exists')
  await db.locationTag.update({
    where: { id: tagId },
    data: { name },
  })
  revalidatePath('/settings')
  revalidatePath('/libraries', 'layout')
}

export async function updateDisplayAction(form: FormData) {
  const user = await requireUser()
  const settings = {
    defaultView:
      value(form, 'defaultView') === 'LIST'
        ? LibraryView.LIST
        : LibraryView.GRID,
    showCover: form.has('showCover'),
    showTitle: form.has('showTitle'),
    showAuthors: form.has('showAuthors'),
    showGenre: form.has('showGenre'),
    showReading: form.has('showReading'),
    showLocation: form.has('showLocation'),
  }
  await db.userDisplaySettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...settings },
    update: settings,
  })
  revalidatePath('/settings')
  revalidatePath('/libraries', 'layout')
}

export async function updateLanguageAction(form: FormData) {
  const user = await requireUser()
  const language = value(form, 'language')
  if (language !== Language.KO && language !== Language.EN)
    redirect('/settings?error=invalid-language')
  await db.userDisplaySettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, language },
    update: { language },
  })
  await setLanguageCookie(language)
  revalidatePath('/', 'layout')
  redirect('/settings?status=language-updated')
}

export async function addKyoboBookAction(form: FormData) {
  const user = await requireUser()
  const libraryId = value(form, 'libraryId')
  const q = value(form, 'q').slice(0, 120)
  const source = value(form, 'source') === 'all' ? 'all' : 'kyobo'
  await requireLibraryAccess(user, libraryId, 'WRITE')
  const saleId = value(form, 'saleId')
  const book = await getKyoboBook(saleId)
  kyoboBookUrlSchema.parse(book.sourceUrl)
  const duplicate = await db.book.findFirst({
    where: {
      libraryId,
      OR: [
        book.isbn.length === 10 ? { isbn10: book.isbn } : { isbn13: book.isbn },
        { sourceUrl: book.sourceUrl },
      ],
    },
    select: { id: true },
  })
  if (duplicate) {
    const query = new URLSearchParams({
      q,
      source,
      selected: saleId,
      libraryId,
      status: 'already-exists',
    })
    redirect(`/search?${query}`)
  }
  const cover = book.coverUrl
    ? await downloadCover(book.coverUrl).catch(() => null)
    : null
  try {
    await db.$transaction(async (tx) => {
      const genreIds = await upsertGenrePaths(tx, book.genrePaths)
      const created = await tx.book.create({
        data: {
          libraryId,
          title: book.title,
          authors: book.authors,
          description: book.description,
          isbn13: book.isbn,
          sourceUrl: book.sourceUrl,
          format:
            book.format === 'EBOOK' ? BookFormat.EBOOK : BookFormat.PHYSICAL,
          coverKey: cover?.key,
          coverMime: cover?.mime,
          coverWidth: cover?.width,
          coverHeight: cover?.height,
          genres: { create: genreIds.map((genreId) => ({ genreId })) },
        },
      })
      await tx.auditLog.create({
        data: {
          actorType: ActorType.USER,
          actorId: user.id,
          action: 'BOOK_CREATED',
          targetType: 'Book',
          targetId: created.id,
          libraryId,
          summary: { isbn: book.isbn, source: 'kyobo' },
        },
      })
    })
  } catch (error) {
    await removeCover(cover?.key)
    throw error
  }
  revalidatePath(`/libraries/${libraryId}`)
  const query = new URLSearchParams({
    q,
    source,
    libraryId,
    status: 'added',
  })
  redirect(`/search?${query}`)
}

export async function addManualBookAction(form: FormData) {
  const user = await requireUser()
  const libraryId = value(form, 'libraryId')
  await requireLibraryAccess(user, libraryId, 'WRITE')
  const sourceUrl = kyoboBookUrlSchema.parse(value(form, 'sourceUrl'))
  const genrePaths = value(form, 'genrePaths')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.split('>').map((part) => {
        const [name, url] = part.split('|').map((item) => item.trim())
        return { name, url }
      }),
    )
  const isbn = value(form, 'isbn').replace(/[-\s]/g, '')
  if (!/^\d{10,13}$/.test(isbn)) throw new Error('A valid ISBN is required')
  await db.$transaction(async (tx) => {
    const genreIds = await upsertGenrePaths(tx, genrePaths)
    const created = await tx.book.create({
      data: {
        libraryId,
        title: value(form, 'title').slice(0, 300),
        authors: value(form, 'authors')
          .split(',')
          .map((author) => author.trim())
          .filter(Boolean),
        description: value(form, 'description').slice(0, 5_000),
        isbn13: isbn.length === 13 ? isbn : null,
        isbn10: isbn.length === 10 ? isbn : null,
        sourceUrl,
        format:
          value(form, 'format') === 'EBOOK'
            ? BookFormat.EBOOK
            : BookFormat.PHYSICAL,
        genres: { create: genreIds.map((genreId) => ({ genreId })) },
      },
    })
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: user.id,
        action: 'BOOK_CREATED',
        targetType: 'Book',
        targetId: created.id,
        libraryId,
        summary: { isbn, source: 'manual' },
      },
    })
  })
  revalidatePath(`/libraries/${libraryId}`)
  redirect(`/libraries/${libraryId}`)
}

export async function updateBookAction(form: FormData) {
  const user = await requireUser()
  const bookId = value(form, 'bookId')
  const { libraryId } = await requireBookAccess(user, bookId, 'WRITE')
  const format =
    value(form, 'format') === 'EBOOK' ? BookFormat.EBOOK : BookFormat.PHYSICAL
  const readingState = ['READING', 'DONE'].includes(value(form, 'readingState'))
    ? (value(form, 'readingState') as ReadingState)
    : ReadingState.NOT_STARTED
  const ratingValue = value(form, 'rating')
  const rating = ratingValue ? Number(ratingValue) : null
  if (
    rating !== null &&
    (!Number.isInteger(rating) || rating < 1 || rating > 5)
  )
    throw new Error('Rating must be 1 to 5')
  const locationTagId =
    format === BookFormat.PHYSICAL && value(form, 'locationTagId')
      ? value(form, 'locationTagId')
      : null
  const library = await db.library.findUniqueOrThrow({
    where: { id: libraryId },
    select: { ownerId: true },
  })
  if (
    locationTagId &&
    !(await db.locationTag.findFirst({
      where: { id: locationTagId, userId: library.ownerId },
    }))
  )
    throw new Error('Invalid location')
  const startedInput = value(form, 'readingStartedAt')
  const finishedInput = value(form, 'readingFinishedAt')
  const readingStartedAt =
    readingState === ReadingState.NOT_STARTED
      ? null
      : startedInput
        ? new Date(startedInput)
        : new Date()
  const readingFinishedAt =
    readingState === ReadingState.DONE
      ? finishedInput
        ? new Date(finishedInput)
        : new Date()
      : null
  if (
    readingStartedAt &&
    readingFinishedAt &&
    readingFinishedAt < readingStartedAt
  )
    throw new Error('Finish date cannot be before start date')
  await db.book.update({
    where: { id: bookId },
    data: {
      title: value(form, 'title').slice(0, 300),
      authors: value(form, 'authors')
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean),
      comment: value(form, 'comment').slice(0, 10_000),
      ownershipState:
        value(form, 'ownershipState') === 'DONT_HAVE'
          ? OwnershipState.DONT_HAVE
          : OwnershipState.HAVE,
      format,
      readingState,
      readingStartedAt,
      readingFinishedAt,
      rating,
      locationTagId,
    },
  })
  revalidatePath(`/libraries/${libraryId}`)
  revalidatePath(`/books/${bookId}`)
}

export async function deleteBookAction(form: FormData) {
  const user = await requireUser()
  const bookId = value(form, 'bookId')
  const { libraryId } = await requireBookAccess(user, bookId, 'WRITE')
  const book = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Book" WHERE "id" = ${bookId} FOR UPDATE`
    const deleting = await tx.book.findUniqueOrThrow({
      where: { id: bookId },
      select: { coverKey: true, files: { select: { storageKey: true } } },
    })
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: user.id,
        action: 'BOOK_DELETED',
        targetType: 'Book',
        targetId: bookId,
        libraryId,
        summary: {},
      },
    })
    await tx.book.delete({ where: { id: bookId } })
    return deleting
  })
  await removeCover(book.coverKey)
  await removeBookFiles(book.files.map((file) => file.storageKey))
  redirect(`/libraries/${libraryId}`)
}

export async function toggleUserDisabledAction(form: FormData) {
  const admin = await requireAdmin()
  const userId = value(form, 'userId')
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  const disabledAt = user.disabledAt ? null : new Date()
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { disabledAt } }),
    db.userSession.deleteMany({ where: { userId } }),
    db.auditLog.create({
      data: {
        actorType: ActorType.ADMIN,
        actorId: admin.id,
        action: disabledAt ? 'USER_DISABLED' : 'USER_ENABLED',
        targetType: 'User',
        targetId: userId,
        summary: { loginId: user.loginId },
      },
    }),
  ])
  revalidatePath('/admin')
}

export async function ensureAdminSetupToken() {
  if (await currentAdmin()) redirect('/admin')
  if ((await db.admin.count()) > 0) return false
  const current = await db.adminSetupToken.findUnique({
    where: { id: 'initial' },
  })
  if (!current || current.expiresAt <= new Date()) {
    const token = randomBytes(24).toString('base64url')
    await db.adminSetupToken.upsert({
      where: { id: 'initial' },
      update: {
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
      create: {
        id: 'initial',
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    })
    console.info(
      `Initial administrator setup: http://localhost:3000/admin/setup?token=${token}`,
    )
  }
  return true
}
