import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolve resource → clubId and verify read access.
  const resource = await db.resource.findUnique({ where: { id }, select: { clubId: true } })
  if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', resource.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const upcoming = url.searchParams.get('upcoming') === 'true'

  const where: any = { resourceId: id }
  if (upcoming) where.startTime = { gte: new Date() }

  const bookings = await db.resourceBooking.findMany({
    where,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startTime: 'asc' },
  })

  return NextResponse.json({ bookings })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = await db.resource.findUnique({ where: { id }, select: { clubId: true, requiresApproval: true } })
  if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  // Booking requires club:read (members can book resources). Approval flow
  // is handled by the requiresApproval flag on the resource.
  if (!hasPermission(user, 'club:read', resource.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Check for conflicts
  const start = new Date(body.startTime)
  const end = new Date(body.endTime)
  const conflicts = await db.resourceBooking.findFirst({
    where: {
      resourceId: id,
      status: { in: ['PENDING', 'APPROVED'] },
      OR: [
        { startTime: { lte: start }, endTime: { gt: start } },
        { startTime: { lt: end }, endTime: { gte: end } },
        { startTime: { gte: start }, endTime: { lte: end } },
      ],
    },
  })

  if (conflicts) {
    return NextResponse.json({ error: 'Time conflicts with existing booking' }, { status: 409 })
  }

  const booking = await db.resourceBooking.create({
    data: {
      resourceId: id,
      userId: user.id,  // always the signed-in user
      eventId: body.eventId || null,
      startTime: start,
      endTime: end,
      purpose: body.purpose || null,
      status: resource.requiresApproval ? 'PENDING' : 'APPROVED',
      notes: body.notes || null,
    },
  })

  return NextResponse.json(booking)
}
