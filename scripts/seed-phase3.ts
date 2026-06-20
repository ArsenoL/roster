/**
 * Phase 3 seed — adds demo data for all the new Phase 3 features:
 *   - Email templates (real, with merge fields)
 *   - Webhooks (with secrets)
 *   - Meeting minutes (for completed events)
 *   - Maintenance logs
 *   - Digest subscriptions
 *   - API keys
 *   - Club invites (some accepted, some pending)
 *   - Parent portal tokens + a sample excuse
 *   - Conversation + messages
 *   - Saved views
 *   - Event waitlist entries
 *   - Recurrence rules (for any recurring events)
 *
 * Run with: bun run scripts/seed-phase3.ts
 */

import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Phase 3 data...')

  const clubs = await db.club.findMany({ take: 3 })
  if (clubs.length === 0) {
    console.log('No clubs found — run seed-phase1/2 first')
    return
  }

  let created = 0

  // ============================================
  // 1. EMAIL TEMPLATES — one welcome + one reminder per club
  // ============================================
  for (const club of clubs) {
    await db.emailTemplate.upsert({
      where: { id: `seed-tpl-welcome-${club.id}` },
      create: {
        id: `seed-tpl-welcome-${club.id}`,
        clubId: club.id,
        name: 'Welcome Email',
        subject: `Welcome to ${club.name}, {{name}}!`,
        body: `<div style="font-family:sans-serif">
          <h2>Hi {{name}},</h2>
          <p>Welcome to <strong>${club.name}</strong>! We're excited to have you.</p>
          <p>Our next meeting is coming up soon — keep an eye on your inbox.</p>
          <p>Best,<br/>The ${club.name} team</p>
        </div>`,
        type: 'welcome',
      },
      update: {},
    })

    await db.emailTemplate.upsert({
      where: { id: `seed-tpl-reminder-${club.id}` },
      create: {
        id: `seed-tpl-reminder-${club.id}`,
        clubId: club.id,
        name: 'Event Reminder',
        subject: `Reminder: {{event_title}} tomorrow`,
        body: `<p>Hi {{name}},</p><p>Just a friendly reminder: <strong>{{event_title}}</strong> is tomorrow at {{event_time}}.</p>`,
        type: 'reminder',
      },
      update: {},
    })

    await db.emailTemplate.upsert({
      where: { id: `seed-tpl-digest-${club.id}` },
      create: {
        id: `seed-tpl-digest-${club.id}`,
        clubId: club.id,
        name: 'Weekly Digest',
        subject: `${club.name} — Your weekly digest`,
        body: `<h2>Hi {{name}}</h2><p>Here's what happened in <strong>${club.name}</strong> this week:</p><ul><li>Events: {{event_count}}</li><li>Your attendance: {{attendance_rate}}%</li></ul>`,
        type: 'digest',
      },
      update: {},
    })
    created += 3
  }
  console.log(`  ✓ ${created} email templates`)

  // ============================================
  // 2. WEBHOOKS — 2 per club (Slack + Make)
  // ============================================
  created = 0
  for (const club of clubs) {
    await db.webhook.upsert({
      where: { id: `seed-hook-slack-${club.id}` },
      create: {
        id: `seed-hook-slack-${club.id}`,
        clubId: club.id,
        name: 'Slack #club-announcements',
        url: 'https://example.com/webhook/slack-placeholder',
        events: JSON.stringify(['announcement.created', 'event.created', 'event.cancelled']),
        secret: randomBytes(24).toString('hex'),
        isActive: true,
        lastTriggeredAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        lastResponseStatus: 200,
      },
      update: {},
    })

    await db.webhook.upsert({
      where: { id: `seed-hook-make-${club.id}` },
      create: {
        id: `seed-hook-make-${club.id}`,
        clubId: club.id,
        name: 'Make.com — attendance sync',
        url: 'https://hook.make.com/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        events: JSON.stringify(['attendance.checked_in', 'member.joined', 'member.left']),
        secret: randomBytes(24).toString('hex'),
        isActive: true,
        lastTriggeredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        lastResponseStatus: 200,
      },
      update: {},
    })
    created += 2
  }
  console.log(`  ✓ ${created} webhooks`)

  // ============================================
  // 3. MEETING MINUTES — for 5 completed events per club
  // ============================================
  created = 0
  for (const club of clubs) {
    const events = await db.event.findMany({
      where: { clubId: club.id, status: 'COMPLETED' },
      take: 5,
    })
    for (const e of events) {
      const exists = await db.meetingMinutes.findUnique({ where: { eventId: e.id } })
      if (exists) continue
      await db.meetingMinutes.create({
        data: {
          eventId: e.id,
          clubId: club.id,
          content: `## ${e.title}\n\nThe meeting started at ${e.startTime.toLocaleString()} and was called to order by the club president. The main agenda items were:\n\n1. Review of previous meeting's action items\n2. Discussion of upcoming events\n3. Budget review\n4. Open floor for member concerns\n\nThe discussion was productive, with active participation from all members present.`,
          attendance: JSON.stringify({ present: 28, late: 4, absent: 5, excused: 2 }),
          decisions: JSON.stringify([
            'Approved budget of $200 for refreshments at the next social event',
            'Decided to move weekly meetings from Room 204 to Room 302 starting next week',
            'Voted to sponsor 3 members to attend the regional conference',
          ]),
          actionItems: JSON.stringify([
            { text: 'Book Room 302 for next 4 weeks', assignee: 'Secretary', due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
            { text: 'Send out conference registration forms', assignee: 'Vice President', due: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
            { text: 'Order refreshments', assignee: 'Treasurer', due: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() },
          ]),
          nextMeeting: `${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} at 3:30 PM in Room 302`,
          isApproved: Math.random() > 0.5,
          approvedAt: Math.random() > 0.5 ? new Date() : null,
        },
      })
      created++
    }
  }
  console.log(`  ✓ ${created} meeting minutes`)

  // ============================================
  // 4. MAINTENANCE LOGS — for inventory items
  // ============================================
  created = 0
  for (const club of clubs) {
    const items = await db.inventoryItem.findMany({ where: { clubId: club.id }, take: 8 })
    for (const item of items) {
      const count = await db.maintenanceLog.count({ where: { itemId: item.id } })
      if (count > 0) continue
      const types = ['REPAIR', 'INSPECTION', 'CLEANING', 'SCHEDULED']
      const t = types[Math.floor(Math.random() * types.length)]
      const isCompleted = Math.random() > 0.5
      await db.maintenanceLog.create({
        data: {
          itemId: item.id,
          type: t,
          status: isCompleted ? 'COMPLETED' : (Math.random() > 0.5 ? 'SCHEDULED' : 'IN_PROGRESS'),
          description: `${t.charAt(0) + t.slice(1).toLowerCase()} for ${item.name}: ${['routine check', 'broken part replacement', 'cleaning after event', 'preventive maintenance'][Math.floor(Math.random() * 4)]}`,
          cost: Math.floor(Math.random() * 200),
          vendor: Math.random() > 0.5 ? 'Local Repair Shop' : null,
          scheduledFor: Math.random() > 0.5 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
          completedAt: isCompleted ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
          notes: Math.random() > 0.5 ? 'No issues found.' : null,
        },
      })
      created++
    }
  }
  console.log(`  ✓ ${created} maintenance logs`)

  // ============================================
  // 5. DIGEST SUBSCRIPTIONS — for execs of each club
  // ============================================
  created = 0
  for (const club of clubs) {
    const execs = await db.membership.findMany({
      where: { clubId: club.id, role: { in: ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'COMMITTEE_HEAD'] } },
      take: 5,
    })
    for (const o of execs) {
      const exists = await db.digestSubscription.findUnique({
        where: { userId_clubId: { userId: o.userId, clubId: club.id } },
      })
      if (exists) continue
      await db.digestSubscription.create({
        data: {
          userId: o.userId,
          clubId: club.id,
          frequency: Math.random() > 0.5 ? 'WEEKLY' : 'DAILY',
          dayOfWeek: 1,
          hourOfDay: 8,
          lastSentAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      })
      created++
    }
  }
  console.log(`  ✓ ${created} digest subscriptions`)

  // ============================================
  // 6. API KEYS — 1 per club
  // ============================================
  created = 0
  for (const club of clubs) {
    const count = await db.apiKey.count({ where: { clubId: club.id } })
    if (count > 0) continue
    const raw = `chk_${randomBytes(32).toString('hex')}`
    await db.apiKey.create({
      data: {
        clubId: club.id,
        name: 'Slack sync bot',
        keyHash: createHash('sha256').update(raw).digest('hex'),
        prefix: raw.slice(0, 12),
        scopes: JSON.stringify(['read', 'write']),
        lastUsedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    })
    created++
  }
  console.log(`  ✓ ${created} API keys`)

  // ============================================
  // 7. CLUB INVITES — mix of pending + accepted
  // ============================================
  created = 0
  for (const club of clubs) {
    const count = await db.clubInvite.count({ where: { clubId: club.id } })
    if (count >= 3) continue

    for (let i = 0; i < 3; i++) {
      const token = randomBytes(24).toString('hex')
      const isAccepted = i < 1
      await db.clubInvite.create({
        data: {
          clubId: club.id,
          email: `invited_student_${i}_${club.id.slice(-4)}@school.edu`,
          role: 'MEMBER',
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: isAccepted ? new Date(Date.now() - 24 * 60 * 60 * 1000) : null,
        },
      })
      created++
    }
  }
  console.log(`  ✓ ${created} club invites`)

  // ============================================
  // 8. PARENT PORTAL TOKENS — for parents
  // ============================================
  created = 0
  const parents = await db.user.findMany({ where: { role: 'PARENT' }, take: 5 })
  for (const parent of parents) {
    const exists = await db.parentPortalToken.findFirst({ where: { parentId: parent.id } })
    if (exists) continue
    await db.parentPortalToken.create({
      data: {
        parentId: parent.id,
        token: randomBytes(24).toString('hex'),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    })
    created++
  }
  console.log(`  ✓ ${created} parent portal tokens`)

  // ============================================
  // 9. CONVERSATIONS + MESSAGES — sample DMs between members
  // ============================================
  created = 0
  for (const club of clubs) {
    const members = await db.membership.findMany({
      where: { clubId: club.id, status: 'ACTIVE' },
      take: 4,
      include: { user: { select: { name: true } } },
    })
    if (members.length < 2) continue

    // 2 DIRECT conversations per club
    for (let i = 0; i < Math.min(2, members.length - 1); i++) {
      const a = members[i]
      const b = members[i + 1]
      const existing = await db.conversation.findFirst({
        where: {
          type: 'DIRECT',
          clubId: club.id,
          AND: [
            { participants: { some: { userId: a.userId } } },
            { participants: { some: { userId: b.userId } } },
          ],
        },
      })
      if (existing) continue

      const conv = await db.conversation.create({
        data: {
          clubId: club.id,
          type: 'DIRECT',
          participants: {
            create: [{ userId: a.userId }, { userId: b.userId }],
          },
          messages: {
            create: [
              { senderId: a.userId, body: `Hey ${b.user.name}! Are you coming to the next meeting?` },
              { senderId: b.userId, body: `Yeah definitely! I'll bring the supplies we discussed.` },
              { senderId: a.userId, body: `Awesome — thanks!` },
            ],
          },
        },
      })
      created++
    }
  }
  console.log(`  ✓ ${created} conversations with messages`)

  // ============================================
  // 10. SAVED VIEWS — 1 default dashboard view per member
  // ============================================
  created = 0
  for (const club of clubs.slice(0, 1)) {
    const members = await db.membership.findMany({
      where: { clubId: club.id, role: 'PRESIDENT' },
      take: 1,
    })
    if (members.length === 0) continue
    const exists = await db.savedView.findFirst({ where: { userId: members[0].userId, tab: 'dashboard' } })
    if (exists) continue
    await db.savedView.create({
      data: {
        userId: members[0].userId,
        clubId: club.id,
        tab: 'dashboard',
        name: 'President view',
        filters: JSON.stringify({ showInactive: false, sortBy: 'streak' }),
        isDefault: true,
      },
    })
    created++
  }
  console.log(`  ✓ ${created} saved views`)

  // ============================================
  // 11. EVENT WAITLIST — for full events
  // ============================================
  created = 0
  for (const club of clubs) {
    const fullEvents = await db.event.findMany({
      where: { clubId: club.id, capacity: { not: null } },
      take: 2,
      include: { _count: { select: { rsvps: true, waitlist: true } } },
    })
    for (const e of fullEvents) {
      if (e._count.waitlist > 0) continue
      await db.eventWaitlist.create({
        data: {
          eventId: e.id,
          name: `Waitlisted Student ${Math.floor(Math.random() * 100)}`,
          email: `waitlist_${e.id.slice(-4)}@school.edu`,
          notes: 'Hoping to attend if a spot opens up.',
        },
      })
      created++
    }
  }
  console.log(`  ✓ ${created} waitlist entries`)

  // ============================================
  // 12. OFFBOARDING — 1 graduated member per club
  // ============================================
  created = 0
  for (const club of clubs) {
    const count = await db.memberOffboarding.count({ where: { clubId: club.id } })
    if (count > 0) continue

    // Find a senior to graduate
    const seniors = await db.membership.findMany({
      where: { clubId: club.id, status: 'ALUMNI' },
      take: 1,
      include: { user: { select: { id: true, name: true, email: true, graduationYear: true } } },
    })
    if (seniors.length === 0) continue

    await db.memberOffboarding.create({
      data: {
        userId: seniors[0].userId,
        clubId: club.id,
        type: 'GRADUATION',
        reason: 'Graduated — Class of 2025',
        effectiveDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        farewellMessage: `Dear ${seniors[0].user.name},\n\nThank you for everything you contributed to ${club.name}. Your leadership, dedication, and positivity made our club better. We wish you the best in college and beyond — please stay in touch as an alum!\n\nWith gratitude,\nThe ${club.name} team`,
        alumniInviteSent: true,
      },
    })
    created++
  }
  console.log(`  ✓ ${created} offboarding records`)

  // ============================================
  // 13. SAMPLE EMAIL LOG — to populate the email log panel
  // ============================================
  created = 0
  for (const club of clubs) {
    const logCount = await db.emailLog.count({ where: { clubId: club.id } })
    if (logCount > 5) continue

    const templates = ['Welcome to ' + club.name, 'Meeting moved to Room 302', 'Reminder: Tomorrow\'s event', 'Weekly digest', 'Budget approval needed']
    for (const subject of templates) {
      await db.emailLog.create({
        data: {
          clubId: club.id,
          toEmail: `member_${Math.floor(Math.random() * 100)}@school.edu`,
          subject,
          status: Math.random() > 0.1 ? 'SENT' : 'FAILED',
          error: Math.random() > 0.1 ? null : 'Mailbox full',
          sentAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        },
      })
      created++
    }
  }
  console.log(`  ✓ ${created} email logs`)

  // ============================================
  // 14. ATTENDANCE EXCUSES — sample
  // ============================================
  created = 0
  for (const club of clubs.slice(0, 1)) {
    const event = await db.event.findFirst({ where: { clubId: club.id } })
    if (!event) continue
    const member = await db.membership.findFirst({ where: { clubId: club.id, status: 'ACTIVE' } })
    if (!member) continue
    const exists = await db.attendanceExcuse.findFirst({ where: { eventId: event.id, userId: member.userId } })
    if (exists) continue
    await db.attendanceExcuse.create({
      data: {
        eventId: event.id,
        userId: member.userId,
        reason: 'ILLNESS',
        description: 'Student was out sick with the flu.',
        submittedById: member.userId,
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    })
    created++
  }
  console.log(`  ✓ ${created} attendance excuses`)

  console.log('\n✅ Phase 3 seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
