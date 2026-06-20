// One-shot: update existing seeded clubs' modules field to match the
// realistic-per-club configs in seed.ts. Does NOT re-create anything.
import { db } from '../src/lib/db'

const UPDATES: { nameContains: string, modules: string[] }[] = [
  { nameContains: 'Robotics',     modules: ['members', 'attendance', 'events', 'announcements', 'tasks', 'inventory', 'maintenance'] },
  { nameContains: 'Debate',       modules: ['members', 'attendance', 'events', 'announcements', 'finance', 'applications'] },
  { nameContains: 'Jazz',         modules: ['members', 'attendance', 'events', 'announcements', 'resources', 'inventory'] },
  { nameContains: 'Environmental',modules: ['members', 'attendance', 'events', 'announcements', 'volunteer', 'digests'] },
  { nameContains: 'Mathletes',    modules: ['members', 'attendance', 'events', 'announcements', 'applications'] },
]

async function main() {
  for (const u of UPDATES) {
    const club = await db.club.findFirst({ where: { name: { contains: u.nameContains } } })
    if (!club) {
      console.log(`NOT FOUND: ${u.nameContains}`)
      continue
    }
    await db.club.update({
      where: { id: club.id },
      data: { modules: JSON.stringify(u.modules) },
    })
    console.log(`${club.name}: ${u.modules.length} modules enabled`)
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
