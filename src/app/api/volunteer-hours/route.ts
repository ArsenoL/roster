import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/volunteer-hours?clubId=...&userId=...&status=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'volunteer')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const userId = url.searchParams.get('userId')
  const status = url.searchParams.get('status')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (userId) where.userId = userId
  if (status) where.status = status

  const hours = await db.volunteerHours.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, grade: true, graduationYear: true } },
      event: { select: { id: true, title: true } },
    },
    orderBy: { date: 'desc' },
  })

  // Summary
  const totalApproved = hours.filter(h => h.status === 'APPROVED').reduce((s, h) => s + h.hours, 0)
  const totalPending = hours.filter(h => h.status === 'PENDING').reduce((s, h) => s + h.hours, 0)

  // Per member
  const perMember = new Map<string, { userId: string, name: string, approved: number, pending: number, count: number }>()
  hours.forEach(h => {
    const cur = perMember.get(h.userId) || { userId: h.userId, name: h.user.name, approved: 0, pending: 0, count: 0 }
    if (h.status === 'APPROVED') cur.approved += h.hours
    else if (h.status === 'PENDING') cur.pending += h.hours
    cur.count++
    perMember.set(h.userId, cur)
  })

  return NextResponse.json({
    hours,
    summary: {
      totalApproved,
      totalPending,
      totalEntries: hours.length,
    },
    perMember: Array.from(perMember.values()).sort((a, b) => b.approved - a.approved),
  })
}

// POST /api/volunteer-hours
export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'volunteer')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const h = await db.volunteerHours.create({
    data: {
      clubId: body.clubId,
      userId: body.userId,
      eventId: body.eventId || null,
      hours: parseFloat(body.hours),
      date: new Date(body.date),
      description: body.description,
      organization: body.organization || null,
      location: body.location || null,
      supervisor: body.supervisor || null,
      evidence: body.evidence || null,
      status: 'PENDING',
    },
  })

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'VolunteerHours',
      entityId: h.id,
      clubId: body.clubId,
      after: JSON.stringify(h),
    },
  })

  return NextResponse.json(h)
}
