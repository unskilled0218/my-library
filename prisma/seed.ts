import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') return

  const passwordHash = await hash('library-demo-password', 12)
  await prisma.user.upsert({
    where: { loginId: 'reader' },
    update: {},
    create: {
      loginId: 'reader',
      passwordHash,
      settings: { create: {} },
      locationTags: {
        create: [{ name: 'Living room' }, { name: 'Study' }],
      },
      libraries: {
        create: {
          name: 'My library',
          description: 'A quiet place for books worth keeping.',
        },
      },
    },
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
