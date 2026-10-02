import { ActorType, type BookFileType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireBookAccess } from '@/lib/access'
import { currentUser } from '@/lib/auth'
import {
  BookFileValidationError,
  MAX_BOOK_FILE_BYTES,
  parseBookFileType,
  readBookFile,
  removeBookFile,
  saveBookFile,
} from '@/lib/book-files'
import { db } from '@/lib/db'

type Context = { params: Promise<{ id: string; type: string }> }

function notFound() {
  return new Response('Not found', { status: 404 })
}

function contentDisposition(name: string) {
  const fallback = name
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(name).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

async function authorized(
  context: Context,
  level: 'READ' | 'WRITE',
): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>
  id: string
  type: BookFileType
} | null> {
  const user = await currentUser()
  if (!user) return null
  const { id, type: rawType } = await context.params
  const type = parseBookFileType(rawType)
  if (!type) return null
  try {
    await requireBookAccess(user, id, level)
    return { user, id, type }
  } catch {
    return null
  }
}

async function cleanup(key: string) {
  try {
    await removeBookFile(key)
  } catch (error) {
    console.error('Book file cleanup failed', error)
  }
}

export async function GET(_request: Request, context: Context) {
  const auth = await authorized(context, 'READ')
  if (!auth) return notFound()
  const record = await db.bookFile.findUnique({
    where: { bookId_type: { bookId: auth.id, type: auth.type } },
  })
  if (!record) return notFound()
  try {
    const body = await readBookFile(record.storageKey)
    return new Response(body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': contentDisposition(record.originalName),
        'Content-Length': String(body.length),
        'Content-Type': record.mime,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFound()
  }
}

export async function POST(request: Request, context: Context) {
  const auth = await authorized(context, 'WRITE')
  if (!auth) return notFound()
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BOOK_FILE_BYTES + 1024 * 1024)
    return Response.json({ error: 'file-too-large' }, { status: 413 })

  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get('file')
  } catch {
    return Response.json({ error: 'invalid-file' }, { status: 400 })
  }
  if (!(file instanceof File))
    return Response.json({ error: 'invalid-file' }, { status: 400 })

  let saved: Awaited<ReturnType<typeof saveBookFile>>
  try {
    saved = await saveBookFile(file, auth.type)
  } catch (error) {
    if (error instanceof BookFileValidationError)
      return Response.json(
        { error: error.code },
        { status: error.code === 'file-too-large' ? 413 : 400 },
      )
    throw error
  }

  let previousKey: string | null = null
  let replaced = false
  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Book" WHERE "id" = ${auth.id} FOR UPDATE`
      const previous = await tx.bookFile.findUnique({
        where: { bookId_type: { bookId: auth.id, type: auth.type } },
      })
      await tx.bookFile.upsert({
        where: { bookId_type: { bookId: auth.id, type: auth.type } },
        create: { bookId: auth.id, type: auth.type, ...saved },
        update: saved,
      })
      await tx.auditLog.create({
        data: {
          actorType: ActorType.USER,
          actorId: auth.user.id,
          action: previous ? 'BOOK_FILE_REPLACED' : 'BOOK_FILE_UPLOADED',
          targetType: 'Book',
          targetId: auth.id,
          summary: { type: auth.type, size: saved.size },
          libraryId: (
            await tx.book.findUniqueOrThrow({
              where: { id: auth.id },
              select: { libraryId: true },
            })
          ).libraryId,
        },
      })
      return previous?.storageKey ?? null
    })
    previousKey = result
    replaced = Boolean(result)
  } catch (error) {
    await cleanup(saved.storageKey)
    throw error
  }

  if (previousKey && previousKey !== saved.storageKey)
    await cleanup(previousKey)
  revalidatePath(`/books/${auth.id}`)
  return Response.json(
    { uploaded: true, replaced },
    { status: replaced ? 200 : 201 },
  )
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await authorized(context, 'WRITE')
  if (!auth) return notFound()
  const storageKey = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Book" WHERE "id" = ${auth.id} FOR UPDATE`
    const record = await tx.bookFile.findUnique({
      where: { bookId_type: { bookId: auth.id, type: auth.type } },
    })
    if (!record) return null
    const book = await tx.book.findUniqueOrThrow({
      where: { id: auth.id },
      select: { libraryId: true },
    })
    await tx.bookFile.delete({ where: { id: record.id } })
    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: auth.user.id,
        action: 'BOOK_FILE_REMOVED',
        targetType: 'Book',
        targetId: auth.id,
        summary: { type: auth.type, size: record.size },
        libraryId: book.libraryId,
      },
    })
    return record.storageKey
  })
  if (!storageKey) return notFound()
  await cleanup(storageKey)
  revalidatePath(`/books/${auth.id}`)
  return new Response(null, { status: 204 })
}
