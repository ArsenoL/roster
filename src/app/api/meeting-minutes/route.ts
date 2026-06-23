import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/meeting-minutes?clubId=...&eventId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'meeting-minutes')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const eventId = url.searchParams.get('eventId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  if (eventId) where.eventId = eventId

  const minutes = await db.meetingMinutes.findMany({
    where,
    include: {
      event: { select: { id: true, title: true, startTime: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ minutes })
}

// POST /api/meeting-minutes — create or update by eventId
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'meeting-minutes')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!body.eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  const data = {
    eventId: body.eventId,
    clubId: body.clubId,
    content: body.content || '',
    attendance: body.attendance ? JSON.stringify(body.attendance) : null,
    decisions: body.decisions ? JSON.stringify(body.decisions) : null,
    actionItems: body.actionItems ? JSON.stringify(body.actionItems) : null,
    nextMeeting: body.nextMeeting || null,
    recordedById: user.id,  // always the signed-in user
  }

  // Upsert by eventId (unique)
  const minutes = await db.meetingMinutes.upsert({
    where: { eventId: body.eventId },
    create: data,
    update: {
      content: data.content,
      attendance: data.attendance,
      decisions: data.decisions,
      actionItems: data.actionItems,
      nextMeeting: data.nextMeeting,
      recordedById: data.recordedById,
    },
    include: { event: { select: { title: true, startTime: true } } },
  })

  await db.auditLog.create({
    data: { action: 'upsert', entity: 'MeetingMinutes', entityId: minutes.id, clubId: body.clubId, userId: user.id }
  })

  return NextResponse.json({ minutes })
}
