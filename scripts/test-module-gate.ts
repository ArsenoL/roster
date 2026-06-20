// Quick test: set the Jazz Ensemble club to Core 3 only, then verify
// the /api/finance route returns 403 for it.
import { db } from '../src/lib/db'

async function main() {
  const jazz = await db.club.findFirst({ where: { name: { contains: 'Jazz' } } })
  if (!jazz) {
    console.log('Jazz club not found')
    process.exit(1)
  }
  console.log('Found:', jazz.name, jazz.id)
  await db.club.update({
    where: { id: jazz.id },
    data: { modules: JSON.stringify(['members', 'attendance', 'events']) },
  })
  console.log('Set modules to Core 3.')
  const verify = await db.club.findUnique({ where: { id: jazz.id } })
  console.log('Verified modules:', verify?.modules)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
