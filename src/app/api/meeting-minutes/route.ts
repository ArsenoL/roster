import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/meeting-minutes?clubId=...&eventId=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'meeting-minutes')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const eventId = url.searchParams.get('eventId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (eventId) where.eventId = eventId

  const minutes = await db.meetingMinutes.findMany({
    where,
    include: {
      event: { select: { id: true, title: true, startTime: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ minutes })
}

// POST /api/meeting-minutes — create or update by eventId
export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'meeting-minutes')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const data = {
    eventId: body.eventId,
    clubId: body.clubId,
    content: body.content || '',
    attendance: body.attendance ? JSON.stringify(body.attendance) : null,
    decisions: body.decisions ? JSON.stringify(body.decisions) : null,
    actionItems: body.actionItems ? JSON.stringify(body.actionItems) : null,
    nextMeeting: body.nextMeeting || null,
    recordedById: body.recordedById || null,
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
    data: { action: 'upsert', entity: 'MeetingMinutes', entityId: minutes.id, clubId: body.clubId }
  })

  return NextResponse.json({ minutes })
}
