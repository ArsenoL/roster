import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'resources')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')

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

  const resources = await db.resource.findMany({
    where,
    include: {
      bookings: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { startTime: 'desc' },
        take: 10,
      },
      _count: { select: { bookings: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ resources })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'resources')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const r = await db.resource.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      type: body.type,
      description: body.description || null,
      location: body.location || null,
      capacity: body.capacity || null,
      imageUrl: body.imageUrl || null,
      isBookable: body.isBookable ?? true,
      bookingWindowDays: body.bookingWindowDays || 90,
      maxBookingHours: body.maxBookingHours || 8,
      requiresApproval: body.requiresApproval || false,
      contactUserId: body.contactUserId || null,
      tags: body.tags ?? null,
    },
  })

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'Resource',
      entityId: r.id,
      clubId: body.clubId,
      userId: user.id,
      after: JSON.stringify(r),
    },
  })

  return NextResponse.json(r)
}
