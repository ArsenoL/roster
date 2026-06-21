import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitClubEvent } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/events?clubId=...&from=...&to=...&type=...
// Auth required. Events for a specific club require club:read membership;
// no clubId means "all events across my clubs" for tenant admins.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const type = url.searchParams.get('type')
  const status = url.searchParams.get('status')
  const upcoming = url.searchParams.get('upcoming') === 'true'

  // If a specific club is requested, the caller must be a member of it.
  if (clubId && !hasPermission(user, 'club:read', clubId) && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (type && type !== 'ALL') where.type = type
  if (status && status !== 'ALL') where.status = status
  if (from || to) {
    where.startTime = {}
    if (from) where.startTime.gte = new Date(from)
    if (to) where.startTime.lte = new Date(to)
  }
  if (upcoming) {
    where.startTime = { gte: new Date() }
  }
  // Non-tenant-admins without a specific clubId only see events for clubs
  // they're an active member of — otherwise this endpoint leaks the entire
  // tenant's calendar to any signed-in user.
  if ((!clubId || clubId === 'ALL') && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships.map((m) => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }

  const events = await db.event.findMany({
    where,
    include: {
      club: { select: { id: true, name: true, primaryColor: true } },
      _count: { select: { attendances: true, checkIns: true } },
    },
    orderBy: { startTime: 'asc' },
    take: 200,
  })

  // Enrich with attendance stats
  const enriched = await Promise.all(events.map(async (e) => {
    const stats = await db.attendance.groupBy({
      by: ['status'],
      where: { eventId: e.id },
      _count: { status: true },
    })
    const statMap: Record<string, number> = {}
    stats.forEach(s => { statMap[s.status] = s._count.status })
    return { ...e, attendanceStats: statMap }
  }))

  return NextResponse.json({ events: enriched })
}

// POST /api/events — create an event (supports recurring)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { recurrence, ...eventData } = body

  // Scheduling an event on a club requires events:write (or club:write).
  if (!eventData.clubId || !hasPermission(user, 'events:write', eventData.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Single event
  if (!recurrence || recurrence === 'none') {
    const event = await db.event.create({
      data: {
        ...eventData,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
        isRecurring: false,
      }
    })
    await db.auditLog.create({
      data: { action: 'create', entity: 'Event', entityId: event.id, clubId: eventData.clubId, userId: user.id, after: JSON.stringify(event) }
    })

    // Fire webhook + notify members about new event
    emitClubEvent(eventData.clubId, 'event.created', {
      title: `New event: ${event.title}`,
      body: `${event.title} on ${new Date(event.startTime).toLocaleString()}${event.location ? ` at ${event.location}` : ''}`,
      link: `/api/events?id=${event.id}`,
      payload: event,
      notifyAllMembers: true,
    }).catch(() => {})

    return NextResponse.json({ event, created: [event] })
  }

  // Recurring — persist the rule, then materialize N instances
  const count = body.recurrenceCount || 12
  const start = new Date(eventData.startTime)
  const end = new Date(eventData.endTime)

  // Create the parent/template event first
  const parentEvent = await db.event.create({
    data: {
      ...eventData,
      startTime: start,
      endTime: end,
      isRecurring: true,
      recurrence,
    }
  })

  // Persist the rule for future regeneration
  await db.recurrenceRule.create({
    data: {
      clubId: eventData.clubId,
      parentEventId: parentEvent.id,
      frequency: recurrence.toUpperCase(),
      interval: 1,
      endDate: body.recurrenceEndDate ? new Date(body.recurrenceEndDate) : null,
      count,
      lastGeneratedAt: new Date(),
    },
  })

  const duration = end.getTime() - start.getTime()
  const created: Awaited<ReturnType<typeof db.event.create>>[] = []
  for (let i = 1; i < count; i++) {  // start at 1 — parentEvent is instance 0
    const s = new Date(start)
    const e = new Date(end)
    if (recurrence === 'weekly') {
      s.setDate(s.getDate() + i * 7)
      e.setDate(e.getDate() + i * 7)
    } else if (recurrence === 'biweekly') {
      s.setDate(s.getDate() + i * 14)
      e.setDate(e.getDate() + i * 14)
    } else if (recurrence === 'monthly') {
      s.setMonth(s.getMonth() + i)
      e.setMonth(e.getMonth() + i)
    } else if (recurrence === 'daily') {
      s.setDate(s.getDate() + i)
      e.setDate(e.getDate() + i)
    }
    const ev = await db.event.create({
      data: {
        ...eventData,
        startTime: s,
        endTime: e,
        isRecurring: true,
        recurrence,
        parentEventId: parentEvent.id,
      }
    })
    created.push(ev)
  }
  created.unshift(parentEvent)

  await db.auditLog.create({
    data: { action: 'create', entity: 'Event', clubId: eventData.clubId, userId: user.id, after: JSON.stringify({ count: created.length, recurrence, parentEventId: parentEvent.id }) }
  })

  // Fire webhook for the series
  emitClubEvent(eventData.clubId, 'event.created', {
    title: `New recurring event: ${parentEvent.title}`,
    body: `${parentEvent.title} — ${count} sessions starting ${new Date(parentEvent.startTime).toLocaleString()}`,
    link: `/api/events?id=${parentEvent.id}`,
    payload: { parentEvent, instanceCount: count, recurrence },
    notifyAllMembers: true,
  }).catch(() => {})

  return NextResponse.json({ events: created, count: created.length, parentEventId: parentEvent.id })
}
