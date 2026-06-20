import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/attendance-excuses?clubId=...&status=PENDING|APPROVED|DENIED&userId=...
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')
  const userId = url.searchParams.get('userId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.event = { clubId }
  if (status) where.status = status
  if (userId) where.userId = userId

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
 * Body: { eventId, userId, reason, description?, submittedById }
 * Creates a PENDING excuse. Parent portal or student can submit.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, userId, reason, description, submittedById } = body
  if (!eventId || !userId || !reason || !submittedById) {
    return NextResponse.json({ error: 'eventId, userId, reason, submittedById required' }, { status: 400 })
  }

  // Look up existing attendance row to link
  const existingAttendance = await db.attendance.findUnique({
    where: { eventId_userId: { eventId, userId } },
  })

  const excuse = await db.attendanceExcuse.create({
    data: {
      eventId,
      attendanceId: existingAttendance?.id || null,
      userId,
      reason,
      description: description || null,
      submittedById,
      status: 'PENDING',
    },
  })

  return NextResponse.json({ excuse })
}
