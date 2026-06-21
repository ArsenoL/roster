import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/attendance?eventId=...&clubId=...&status=...&from=...&to=...
// Auth required. Attendance records reveal who was at which meeting —
// sensitive PII. Restricted to the caller's own clubs.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const eventId = url.searchParams.get('eventId')
  const clubId = url.searchParams.get('clubId')
  const userIdParam = url.searchParams.get('userId')
  const status = url.searchParams.get('status')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limit = parseInt(url.searchParams.get('limit') || '500')

  const where: any = {}
  if (eventId) where.eventId = eventId
  if (userIdParam) where.userId = userIdParam
  if (status && status !== 'ALL') where.status = status
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'attendance:read', clubId) && !hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.event = { clubId }
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships.map((m) => m.clubId)
    where.event = { clubId: { in: myClubIds.length > 0 ? myClubIds : ['__none__'] } }
  }
  if (from || to) {
    where.event = { ...where.event, startTime: {} }
    if (from) where.event.startTime.gte = new Date(from)
    if (to) where.event.startTime.lte = new Date(to)
  }

  const records = await db.attendance.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, studentId: true, grade: true, avatar: true } },
      event: { select: { id: true, title: true, startTime: true, type: true, club: { select: { id: true, name: true, primaryColor: true } } } },
    },
    orderBy: { event: { startTime: 'desc' } },
    take: limit,
  })

  return NextResponse.json({ attendance: records })
}

// POST /api/attendance — mark/update attendance
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { eventId, userId, status, method, checkInTime, checkOutTime, notes, pointsEarned, bulk } = body

  // Resolve the club for the target event so we can check attendance:write.
  // For bulk updates, all updates target the same eventId — check once.
  const targetEvent = await db.event.findUnique({ where: { id: eventId }, select: { clubId: true } })
  if (!targetEvent) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!hasPermission(user, 'attendance:write', targetEvent.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Bulk update: { eventId, updates: [{userId, status}, ...] }
  if (bulk && Array.isArray(body.updates)) {
    const results: Awaited<ReturnType<typeof db.attendance.upsert>>[] = []
    for (const u of body.updates) {
      const r = await db.attendance.upsert({
        where: { eventId_userId: { eventId, userId: u.userId } },
        create: { eventId, userId: u.userId, status: u.status, method: u.method, notes: u.notes, pointsEarned: u.pointsEarned || (u.status === 'PRESENT' ? 5 : 0) },
        update: { status: u.status, method: u.method || null, notes: u.notes, pointsEarned: u.pointsEarned },
      })
      results.push(r)
    }
    await db.auditLog.create({
      data: { action: 'update', entity: 'Attendance', clubId: targetEvent.clubId, userId: user.id, after: JSON.stringify({ eventId, count: results.length }) }
    })
    return NextResponse.json({ updated: results.length, results })
  }

  // Single upsert
  const record = await db.attendance.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      eventId, userId,
      status: status || 'PRESENT',
      method: method || null,
      checkInTime: checkInTime ? new Date(checkInTime) : (status === 'PRESENT' || status === 'LATE' ? new Date() : null),
      checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
      notes, pointsEarned: pointsEarned ?? (status === 'PRESENT' ? 5 : status === 'LATE' ? 3 : 0),
    },
    update: {
      status, method, notes,
      checkInTime: checkInTime ? new Date(checkInTime) : undefined,
      checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
      pointsEarned,
    },
  })

  // Update streak on PRESENT
  if (status === 'PRESENT') {
    const membership = await db.membership.findUnique({ where: { userId_clubId: { userId, clubId: targetEvent.clubId } } })
    if (membership) {
      // Find all PRESENT events for this user in club, ordered by time
      const presentEvents = await db.attendance.findMany({
        where: { userId, status: 'PRESENT', event: { clubId: membership.clubId } },
        include: { event: { select: { startTime: true } } },
        orderBy: { event: { startTime: 'asc' } }
      })
      // Compute current streak (consecutive most recent)
      let streak = 1
      for (let i = presentEvents.length - 1; i > 0; i--) {
        const cur = presentEvents[i].event.startTime.getTime()
        const prev = presentEvents[i-1].event.startTime.getTime()
        const daysBetween = (cur - prev) / (86400000)
        if (daysBetween <= 14) streak++
        else break
      }
      await db.membership.update({
        where: { id: membership.id },
        data: {
          streak,
          longestStreak: Math.max(membership.longestStreak, streak),
          points: membership.points + (pointsEarned || 5),
        }
      })
    }
  }

  await db.auditLog.create({
    data: { action: 'update', entity: 'Attendance', entityId: record.id, clubId: targetEvent.clubId, userId: user.id, after: JSON.stringify(record) }
  })
  return NextResponse.json({ attendance: record })
}
