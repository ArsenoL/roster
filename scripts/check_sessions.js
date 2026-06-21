const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const sessions = await prisma.userSession.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  console.log('Total sessions:', await prisma.userSession.count());
  for (const s of sessions) {
    console.log({
      id: s.id.slice(0,8),
      user: s.user?.email,
      tokenLen: s.token?.length,
      tokenStart: s.token?.slice(0, 40),
      created: s.createdAt,
      expires: s.expiresAt,
      isExpired: s.expiresAt < new Date(),
      userAgent: s.userAgent?.slice(0,60),
    });
  }
  const users = await prisma.user.count();
  console.log('Total users:', users);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
