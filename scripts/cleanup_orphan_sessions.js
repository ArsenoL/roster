// Clean up orphaned sessions (sessions whose userId references a deleted user).
// SQLite doesn't enforce foreign key cascades by default, so when a User is
// deleted their UserSession rows can be left behind. These orphaned sessions
// cause Prisma to throw "Inconsistent query result: Field user is required
// to return data, got null instead" when included in a query.

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find all sessions
  const allSessions = await prisma.userSession.findMany({
    select: { id: true, userId: true, createdAt: true },
  })
  console.log(`Total sessions: ${allSessions.length}`)

  // Find which userIds still exist
  const userIds = [...new Set(allSessions.map((s) => s.userId))]
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  })
  const existingUserIds = new Set(existingUsers.map((u) => u.id))

  // Find orphaned sessions
  const orphaned = allSessions.filter((s) => !existingUserIds.has(s.userId))
  console.log(`Orphaned sessions: ${orphaned.length}`)

  if (orphaned.length === 0) {
    console.log('Nothing to clean up.')
    return
  }

  // Delete orphaned sessions
  const result = await prisma.userSession.deleteMany({
    where: { id: { in: orphaned.map((s) => s.id) } },
  })
  console.log(`Deleted ${result.count} orphaned sessions.`)

  // Verify
  const remaining = await prisma.userSession.count()
  console.log(`Remaining sessions: ${remaining}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
