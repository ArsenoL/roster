import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/**
 * GET /api/attendance-excuses?status=PENDING|APPROVED|DENIED&userId=...
 * Non-admins can only query their own excuses.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'excuses')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')
  const userId = url.searchParams.get('userId')

  // Non-admins can only see their own excuses.
  if (userId && userId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const where: any = {}
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
  if (status) where.status = status
  if (userId) where.userId = userId
  // If no userId is provided and the user isn't an admin, default to self
  // (don't leak other members' excuses).
  if (!userId && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    where.userId = user.id
  }

  const excuses = await db.attendanceExcuse.findMany({
    where,
    include: {
      event: { select: { id: true, title: true, startTime: true, clubId: true, club: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true, grade: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ excuses })
}

/**
 * POST /api/attendance-excuses
 * Body: { eventId, userId?, reason, description? }
 * If userId is omitted, the signed-in user is the target. Officers can submit
 * excuses on behalf of a member (requires members:write on the event's club).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'excuses')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const { eventId, userId, reason, description } = body
  if (!eventId || !reason) {
    return NextResponse.json({ error: 'eventId, reason required' }, { status: 400 })
  }

  // Resolve the event's club and verify the caller can read it.
  const event = await db.event.findUnique({ where: { id: eventId }, select: { clubId: true } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const targetUserId = userId || user.id
  // Submitting on behalf of another member requires members:write.
  if (targetUserId !== user.id && !hasPermission(user, 'members:write', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Look up existing attendance row to link
  const existingAttendance = await db.attendance.findUnique({
    where: { eventId_userId: { eventId, userId: targetUserId } },
  })

  const excuse = await db.attendanceExcuse.create({
    data: {
      eventId,
      attendanceId: existingAttendance?.id || null,
      userId: targetUserId,
      reason,
      description: description || null,
      submittedById: user.id,  // always the signed-in user
      status: 'PENDING',
    },
  })

  return NextResponse.json({ excuse })
}
