// Clean up test clubs and sessions created during the audit.
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Delete test clubs created by audit scripts
  const testClubs = await prisma.club.findMany({
    where: {
      OR: [
        { name: { startsWith: 'TEST CLUB FROM AUDIT' } },
        { name: 'Auth Flow Test Club' },
        { name: 'Audit 3 Test Club' },
        { name: 'Audit 3 Flow Test Club' },
      ]
    },
    select: { id: true, name: true }
  })
  console.log(`Found ${testClubs.length} test clubs to delete:`)
  for (const c of testClubs) {
    console.log(`  - ${c.name}`)
    // Delete related data first (memberships, settings, audit logs)
    await prisma.membership.deleteMany({ where: { clubId: c.id } }).catch(() => {})
    await prisma.clubSetting.deleteMany({ where: { clubId: c.id } }).catch(() => {})
    await prisma.auditLog.deleteMany({ where: { clubId: c.id } }).catch(() => {})
    await prisma.club.delete({ where: { id: c.id } }).catch(() => {})
  }

  // Delete test users created by audit scripts
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: 'audit-flow-' } },
        { email: { startsWith: 'audit3-flow-' } },
        { email: { startsWith: 'audit-test' } },
        { email: { startsWith: 'audit2' } },
        { email: { startsWith: 'audit3-' } },
        { email: { startsWith: 'cookie-test-' } },
        { email: { contains: 'audit-' } },
      ]
    },
    select: { id: true, email: true }
  })
  console.log(`\nFound ${testUsers.length} test users to delete:`)
  for (const u of testUsers) {
    console.log(`  - ${u.email}`)
    // Delete sessions first (manually, since cascade may not work in SQLite)
    await prisma.userSession.deleteMany({ where: { userId: u.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {})
  }

  // Final counts
  console.log(`\nFinal state:`)
  console.log(`  Users: ${await prisma.user.count()}`)
  console.log(`  Sessions: ${await prisma.userSession.count()}`)
  console.log(`  Clubs: ${await prisma.club.count()}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
