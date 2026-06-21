const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  const sessions = await prisma.userSession.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, name: true, role: true } } },
  })
  for (const s of sessions) {
    const ageMs = s.expiresAt - s.createdAt
    const ageDays = ageMs / 1000 / 60 / 60 / 24
    const isExpired = s.expiresAt < new Date()
    console.log(`${s.createdAt.toISOString()} | expires ${s.expiresAt.toISOString()} | age=${ageDays.toFixed(2)}d | expired=${isExpired} | ${s.user?.email || 'ORPHANED'}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
