import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/volunteer-hours?clubId=...&status=...
// userId filter is restricted: only the signed-in user can ask for their own
// hours; admins can pass any userId.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'volunteer')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const userId = url.searchParams.get('userId')
  const status = url.searchParams.get('status')

  // Non-admins can only query their own hours.
  if (userId && userId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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

// POST /api/volunteer-hours — log hours (self or for another member if officer)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'volunteer')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:read', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Determine the target user. Default to self; officers can log hours for
  // other members (e.g. bulk entry) but must have members:write.
  const targetUserId = body.userId || user.id
  if (targetUserId !== user.id && !hasPermission(user, 'members:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const h = await db.volunteerHours.create({
    data: {
      clubId: body.clubId,
      userId: targetUserId,
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
      userId: user.id,
      after: JSON.stringify(h),
    },
  })

  return NextResponse.json(h)
}
