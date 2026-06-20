import { db } from '../src/lib/db'
async function main() {
  const e = await db.event.findFirst({
    where: { startTime: { gt: new Date() } },
    orderBy: { startTime: 'asc' },
    select: { id: true, title: true, startTime: true, clubId: true }
  })
  console.log(JSON.stringify(e))
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
