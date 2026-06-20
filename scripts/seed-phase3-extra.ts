/**
 * Phase 3.5 seed — adds demo data for new Phase 3.5 features:
 *  - Photo albums with placeholder photos
 *  - Attendance excuses (pending + approved + denied)
 *  - Attendance reminders (mixed scheduled + sent)
 *  - Document comments on existing documents
 *  - Kiosk code on an upcoming event
 *
 * Run: npx tsx scripts/seed-phase3-extra.ts
 */
import { db } from '../src/lib/db'

async function main() {
  const clubs = await db.club.findMany({ take: 3, include: { events: { take: 5, orderBy: { startTime: 'desc' } } } })
  console.log(`Found ${clubs.length} clubs`)

  let photoAlbumsCreated = 0
  let photosCreated = 0
  let excusesCreated = 0
  let remindersCreated = 0
  let commentsCreated = 0
  let kioskCodesSet = 0

  for (const club of clubs) {
    // ----- PHOTO ALBUMS -----
    const album1 = await db.photoAlbum.create({
      data: {
        clubId: club.id,
        eventId: club.events[0]?.id || null,
        title: `${club.name} — Spring Showcase`,
        description: 'Highlights from our spring showcase event.',
        isPublic: true,
      },
    })
    photoAlbumsCreated++

    // Add 4 placeholder photos using picsum.photos
    for (let i = 0; i < 4; i++) {
      await db.photo.create({
        data: {
          albumId: album1.id,
          url: `https://picsum.photos/seed/${club.id}-${i}/600/400`,
          caption: ['Group photo', 'Action shot', 'Award moment', 'Behind the scenes'][i],
          width: 600,
          height: 400,
        },
      })
      photosCreated++
    }

    // Update cover
    await db.photoAlbum.update({ where: { id: album1.id }, data: { coverPhoto: `https://picsum.photos/seed/${club.id}-0/600/400` } })

    const album2 = await db.photoAlbum.create({
      data: {
        clubId: club.id,
        title: `${club.name} — Behind the Scenes`,
        description: 'Casual moments from regular meetings.',
        isPublic: false,
      },
    })
    photoAlbumsCreated++
    for (let i = 0; i < 3; i++) {
      await db.photo.create({
        data: {
          albumId: album2.id,
          url: `https://picsum.photos/seed/${club.id}-bts-${i}/400/400`,
          width: 400, height: 400,
        },
      })
      photosCreated++
    }

    // ----- ATTENDANCE EXCUSES -----
    // Find members + past events to attach excuses to
    const members = await db.membership.findMany({
      where: { clubId: club.id, status: 'ACTIVE' },
      take: 5,
    })
    const pastEvents = club.events.filter(e => e.startTime < new Date())
    if (members.length > 0 && pastEvents.length > 0) {
      // Pending excuse
      await db.attendanceExcuse.create({
        data: {
          eventId: pastEvents[0].id,
          userId: members[0].userId,
          reason: 'Family emergency',
          description: 'Had to leave early to pick up a sibling.',
          submittedById: members[0].userId,
          status: 'PENDING',
        },
      })
      excusesCreated++

      // Approved excuse (with reviewer)
      if (members.length > 1 && pastEvents.length > 1) {
        const adminUser = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
        await db.attendanceExcuse.create({
          data: {
            eventId: pastEvents[1].id,
            userId: members[1].userId,
            reason: 'College visit',
            description: 'Scheduled campus tour at state university.',
            submittedById: members[1].userId,
            submittedById: members[1].userId,
            status: 'APPROVED',
            approvedById: adminUser?.id || members[0].userId,
            reviewedAt: new Date(),
          },
        })
        excusesCreated++
      }

      // Denied excuse
      if (members.length > 2 && pastEvents.length > 2) {
        const adminUser = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } })
        await db.attendanceExcuse.create({
          data: {
            eventId: pastEvents[2].id,
            userId: members[2].userId,
            reason: 'Overslept',
            description: 'Alarm did not go off.',
            submittedById: members[2].userId,
            status: 'DENIED',
            approvedById: adminUser?.id || members[0].userId,
            reviewedAt: new Date(),
          },
        })
        excusesCreated++
      }
    }

    // ----- ATTENDANCE REMINDERS -----
    const upcomingEvents = club.events.filter(e => e.startTime > new Date())
    if (members.length > 0 && upcomingEvents.length > 0) {
      // PRE_EVENT reminder for first member, scheduled in the near future
      await db.attendanceReminder.create({
        data: {
          eventId: upcomingEvents[0].id,
          userId: members[0].userId,
          reminderType: 'PRE_EVENT',
          scheduledFor: new Date(Date.now() + 60 * 60 * 1000), // 1h from now
          channel: 'EMAIL',
        },
      })
      remindersCreated++

      // DAY_OF reminder for second member
      if (members.length > 1) {
        await db.attendanceReminder.create({
          data: {
            eventId: upcomingEvents[0].id,
            userId: members[1].userId,
            reminderType: 'DAY_OF',
            scheduledFor: new Date(Date.now() + 30 * 60 * 1000), // 30min from now
            channel: 'EMAIL',
          },
        })
        remindersCreated++
      }

      // Already-sent reminder (in the past)
      if (members.length > 2) {
        await db.attendanceReminder.create({
          data: {
            eventId: pastEvents[0]?.id || upcomingEvents[0].id,
            userId: members[2].userId,
            reminderType: 'PRE_EVENT',
            scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1d ago
            sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            channel: 'EMAIL',
          },
        })
        remindersCreated++
      }
    }

    // ----- DOCUMENT COMMENTS -----
    const docs = await db.document.findMany({ where: { clubId: club.id }, take: 2 })
    for (const doc of docs) {
      if (members.length === 0) break
      await db.documentComment.create({
        data: {
          documentId: doc.id,
          userId: members[0].userId,
          body: 'Can we add more detail to section 2? It feels thin.',
          anchor: 'section-2',
        },
      })
      commentsCreated++
      if (members.length > 1) {
        await db.documentComment.create({
          data: {
            documentId: doc.id,
            userId: members[1].userId,
            body: 'Agreed — I can take a pass at it this weekend.',
          },
        })
        commentsCreated++
      }
    }

    // ----- KIOSK CODE on first upcoming event -----
    if (upcomingEvents.length > 0) {
      const code = generateCode()
      const event = upcomingEvents[0]
      const metadata = JSON.parse((event as any).metadata || '{}')
      metadata.kioskCode = code
      await db.event.update({
        where: { id: event.id },
        data: { metadata: JSON.stringify(metadata) },
      })
      kioskCodesSet++
      console.log(`  Set kiosk code ${code} on event "${event.title}" (club: ${club.name})`)
    }
  }

  console.log(`\nDone! Created:`)
  console.log(`  ${photoAlbumsCreated} photo albums`)
  console.log(`  ${photosCreated} photos`)
  console.log(`  ${excusesCreated} attendance excuses`)
  console.log(`  ${remindersCreated} attendance reminders`)
  console.log(`  ${commentsCreated} document comments`)
  console.log(`  ${kioskCodesSet} kiosk codes on upcoming events`)
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
