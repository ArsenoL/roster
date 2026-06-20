import { db } from '../src/lib/db'
async function main() {
  const r = await db.attendanceReminder.findFirst({
    where: { sentAt: null },
    include: { event: true, user: true },
  })
  if (!r) { console.log('no reminder to clone'); return }
  // Create a duplicate with past scheduledFor
  const clone = await db.attendanceReminder.create({
    data: {
      eventId: r.eventId,
      userId: r.userId,
      reminderType: r.reminderType,
      scheduledFor: new Date(Date.now() - 60 * 1000), // 1 min ago
      channel: r.channel,
    },
  })
  console.log(`Created reminder ${clone.id} scheduled in the past`)
  console.log(`User: ${r.user.email}, Event: ${r.event.title}`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
