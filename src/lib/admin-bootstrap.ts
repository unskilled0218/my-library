import { randomBytes } from 'node:crypto'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { normalizeLoginId } from '@/lib/validation'
import { tokenHash } from '@/lib/auth'

export async function bootstrapAdmin() {
  if ((await db.admin.count()) > 0) {
    await db.adminSetupToken.deleteMany()
    return
  }

  const env = getEnv()
  if (env.ADMIN_ID && env.ADMIN_PASSWORD) {
    await db.admin.create({
      data: {
        loginId: normalizeLoginId(env.ADMIN_ID),
        passwordHash: await hash(env.ADMIN_PASSWORD, 12),
      },
    })
    console.info(
      'Initial administrator created from environment configuration.',
    )
    return
  }

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
