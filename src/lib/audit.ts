import type { ActorType, Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export async function writeAudit(input: {
  actorType: ActorType
  actorId?: string
  action: string
  targetType: string
  targetId?: string
  libraryId?: string
  summary?: Prisma.InputJsonObject
}) {
  return db.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      libraryId: input.libraryId,
      summary: input.summary ?? {},
    },
  })
}
