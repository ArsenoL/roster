const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  // All sessions for amogh, ordered by creation
  const sessions = await prisma.userSession.findMany({
    where: { user: { email: 'amogh.r.bandekar@gmail.com' } },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`=== ${sessions.length} sessions for amogh.r.bandekar@gmail.com ===`)
  for (const s of sessions) {
    const age = (s.expiresAt - s.createdAt) / 1000 / 60 / 60 / 24
    const extended = age > 14.01 ? 'WAS EXTENDED' : (Math.abs(age - 14) < 0.01 ? 'never extended' : `age=${age.toFixed(2)}d`)
    console.log(`  ${s.createdAt.toISOString()} → expires ${s.expiresAt.toISOString()} (${extended})`)
  }

  // Look for any sessions that were deleted recently — count by hour
  console.log('\n=== Sessions grouped by user (last 24h) ===')
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await prisma.userSession.findMany({
    where: { createdAt: { gt: since } },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  })
  console.log(`Total sessions created in last 24h: ${recent.length}`)
  const byUser = {}
  for (const s of recent) {
    byUser[s.user.email] = (byUser[s.user.email] || 0) + 1
  }
  for (const [email, count] of Object.entries(byUser)) {
    console.log(`  ${email}: ${count} session(s)`)
  }

  // Check the current user's memberships — maybe they already created a club
  const user = await prisma.user.findUnique({
    where: { email: 'amogh.r.bandekar@gmail.com' },
    include: {
      memberships: {
        include: { club: { select: { name: true, createdAt: true } } },
      },
    },
  })
  if (user) {
    console.log(`\n=== User state ===`)
    console.log(`  role: ${user.role}`)
    console.log(`  memberships: ${user.memberships.length}`)
    for (const m of user.memberships) {
      console.log(`    - ${m.club.name} (created ${m.club.createdAt.toISOString()}) role=${m.role} status=${m.status}`)
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
