import { db } from '../src/lib/db'
async function main() {
  const mls = await db.magicLink.findMany({ orderBy: { createdAt: 'desc' }, take: 3 })
  for (const ml of mls) {
    console.log(`email=${ml.email} token=${ml.token} expires=${ml.expiresAt} used=${ml.usedAt}`)
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
