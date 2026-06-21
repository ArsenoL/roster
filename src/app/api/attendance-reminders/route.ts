import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/**
 * GET /api/attendance-reminders?clubId=...&eventId=...&userId=...&unsent=true
 * Non-admins can only query their own reminders.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'reminders')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const eventId = url.searchParams.get('eventId')
  const userId = url.searchParams.get('userId')
  const unsentOnly = url.searchParams.get('unsent') === 'true'

  // Non-admins can only see their own reminders.
  if (userId && userId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where: any = {}
  if (eventId) where.eventId = eventId
  if (userId) where.userId = userId
  // If no userId is provided and the user isn't an admin, default to self
  // (don't leak other members' reminders).
  if (!userId && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    where.userId = user.id
  }
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.event = { clubId }
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    // Non-admins: scope to clubs they can read.
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.event = { clubId: { in: myClubIds.length > 0 ? myClubIds : ['__none__'] } }
  }
  if (unsentOnly) where.sentAt = null

  const reminders = await db.attendanceReminder.findMany({
    where,
    include: {
      event: { select: { id: true, title: true, startTime: true, clubId: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 200,
  })

  return NextResponse.json({ reminders })
}

/**
 * POST /api/attendance-reminders
 * Body: single reminder OR { bulk: true, eventId, reminderType, channel }
 *       When bulk=true, creates reminders for all members of the event's club.
 *       Requires attendance:write (officer action).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'reminders')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()

  if (body.bulk) {
    return createBulkReminders(body, user)
  }

  const { eventId, userId, reminderType, scheduledFor, channel } = body
  if (!eventId || !userId || !reminderType || !scheduledFor) {
    return NextResponse.json(
      { error: 'eventId, userId, reminderType, scheduledFor required' },
      { status: 400 }
    )
  }

  // Verify the caller has attendance:write on the event's club (officer
  // action — creating reminders for members).
  const event = await db.event.findUnique({ where: { id: eventId }, select: { clubId: true } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!hasPermission(user, 'attendance:write', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const reminder = await db.attendanceReminder.create({
    data: {
      eventId,
      userId,
      reminderType,
      scheduledFor: new Date(scheduledFor),
      channel: channel || 'EMAIL',
    },
  })

  return NextResponse.json({ reminder })
}

async function createBulkReminders(body: any, user: any) {
  const { eventId, reminderType, channel, offsetMinutes } = body
  if (!eventId || !reminderType) {
    return NextResponse.json({ error: 'eventId and reminderType required' }, { status: 400 })
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, startTime: true, clubId: true },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  // Bulk reminders require attendance:write on the event's club.
  if (!hasPermission(user, 'attendance:write', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Determine when to send based on reminder type
  const eventTime = new Date(event.startTime)
  let scheduledFor: Date
  switch (reminderType) {
    case 'PRE_EVENT':
      scheduledFor = new Date(eventTime.getTime() - (offsetMinutes || 60 * 24) * 60000) // default 24h before
      break
    case 'DAY_OF':
      scheduledFor = new Date(eventTime)
      scheduledFor.setHours(8, 0, 0, 0) // 8am day of
      break
    case 'POST_EVENT_ABSENCE':
      scheduledFor = new Date(eventTime.getTime() + (offsetMinutes || 60 * 6) * 60000) // 6h after
      break
    default:
      return NextResponse.json({ error: 'Invalid reminderType' }, { status: 400 })
  }

  // Get all active members of the club
  const members = await db.membership.findMany({
    where: { clubId: event.clubId, status: 'ACTIVE' },
    select: { userId: true },
  })

  // Skip if scheduledFor is in the past
  if (scheduledFor < new Date()) {
    return NextResponse.json({
      created: 0,
      skipped: members.length,
      reason: 'scheduledFor is in the past',
    })
  }

  // Bulk create
  const created = await db.$transaction(
    members.map((m) =>
      db.attendanceReminder.create({
        data: {
          eventId: event.id,
          userId: m.userId,
          reminderType,
          scheduledFor,
          channel: channel || 'EMAIL',
        },
      })
    )
  )

  return NextResponse.json({ created: created.length, scheduledFor })
}

/** DELETE /api/attendance-reminders?id=... */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'reminders')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Verify ownership or attendance:write on the reminder's club.
  const existing = await db.attendanceReminder.findUnique({
    where: { id },
    include: { event: { select: { clubId: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.userId !== user.id && !hasPermission(user, 'attendance:write', existing.event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.attendanceReminder.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
