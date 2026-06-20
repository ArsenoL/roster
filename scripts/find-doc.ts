import { db } from '../src/lib/db'
async function main() {
  const d = await db.documentComment.findFirst({ select: { documentId: true } })
  console.log(d?.documentId)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
