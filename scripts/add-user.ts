// @ts-nocheck
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('doaa123', 12)

  const user = await prisma.user.upsert({
    where: { email: 'infosahab@sahab.ae' },
    update: { name: 'infosahab', password, role: 'ADMIN' },
    create: {
      name: 'infosahab',
      email: 'infosahab@sahab.ae',
      password,
      role: 'ADMIN',
    },
  })

  console.log('✓ تم إنشاء المستخدم:', user.name, '|', user.email, '| role:', user.role)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
