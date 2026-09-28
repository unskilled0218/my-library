import { createHash, randomBytes } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { normalizeLoginId, passwordSchema } from '@/lib/validation'

const USER_COOKIE = 'library_user_session'
const ADMIN_COOKIE = 'library_admin_session'
const SESSION_AGE = 60 * 60 * 24 * 30

function tokenHash(token: string) {
  return createHash('sha256')
    .update(`${getEnv().SESSION_SECRET}:${token}`)
    .digest('hex')
}

async function setSessionCookie(name: string, token: string) {
  const jar = await cookies()
  jar.set(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_AGE,
  })
}

export async function createUser(loginIdInput: string, passwordInput: string) {
  const loginId = normalizeLoginId(loginIdInput)
  const password = passwordSchema.parse(passwordInput)
  const passwordHash = await hash(password, 12)
  return db.user.create({
    data: {
      loginId,
      passwordHash,
      settings: { create: {} },
      libraries: {
        create: {
          name: 'My library',
        },
      },
    },
  })
}

export async function signInUser(loginIdInput: string, password: string) {
  const loginId = normalizeLoginId(loginIdInput)
  const user = await db.user.findUnique({ where: { loginId } })
  if (!user || user.disabledAt || !(await compare(password, user.passwordHash)))
    throw new Error('Invalid credentials')
  const token = randomBytes(32).toString('base64url')
  await db.userSession.create({
    data: {
      tokenHash: tokenHash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_AGE * 1000),
    },
  })
  await setSessionCookie(USER_COOKIE, token)
  return user
}

export async function signInAdmin(loginIdInput: string, password: string) {
  const loginId = normalizeLoginId(loginIdInput)
  const admin = await db.admin.findUnique({ where: { loginId } })
  if (
    !admin ||
    admin.disabledAt ||
    !(await compare(password, admin.passwordHash))
  )
    throw new Error('Invalid credentials')
  const token = randomBytes(32).toString('base64url')
  await db.adminSession.create({
    data: {
      tokenHash: tokenHash(token),
      adminId: admin.id,
      expiresAt: new Date(Date.now() + SESSION_AGE * 1000),
    },
  })
  await setSessionCookie(ADMIN_COOKIE, token)
  return admin
}

export async function currentUser() {
  const token = (await cookies()).get(USER_COOKIE)?.value
  if (!token) return null
  const session = await db.userSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  })
  if (!session || session.expiresAt <= new Date() || session.user.disabledAt)
    return null
  return session.user
}

export async function currentAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  if (!token) return null
  const session = await db.adminSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { admin: true },
  })
  if (!session || session.expiresAt <= new Date() || session.admin.disabledAt)
    return null
  return session.admin
}

export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin() {
  const admin = await currentAdmin()
  if (!admin) redirect('/admin/login')
  return admin
}

export async function signOut(kind: 'user' | 'admin') {
  const name = kind === 'user' ? USER_COOKIE : ADMIN_COOKIE
  const token = (await cookies()).get(name)?.value
  if (token) {
    if (kind === 'user')
      await db.userSession.deleteMany({
        where: { tokenHash: tokenHash(token) },
      })
    else
      await db.adminSession.deleteMany({
        where: { tokenHash: tokenHash(token) },
      })
  }
  ;(await cookies()).delete(name)
}

export { tokenHash }
