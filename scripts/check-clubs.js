const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const clubs = await prisma.club.findMany({
    select: {
      id: true, name: true, slug: true, category: true, isPublic: true, status: true,
      _count: { select: { members: true, events: true, announcements: true } }
    },
    take: 10,
    orderBy: { name: 'asc' }
  });
  console.log(JSON.stringify(clubs, null, 2));
  await prisma.$disconnect();
})();
