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

  const resource = await db.resource.findUnique({ where: { id }, select: { clubId: true, requiresApproval: true, bookingWindowDays: true, maxBookingHours: true } })
  if (!resource) return NextResponse.json({ error: 'Resource not found' }, { status: 404 })
  // Booking requires club:read (members can book resources). Approval flow
  // is handled by the requiresApproval flag on the resource.
  if (!hasPermission(user, 'club:read', resource.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Validate start/end — parseable dates, end strictly after start, and
  // start must be in the future.
  const start = new Date(body.startTime)
  const end = new Date(body.endTime)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: 'Invalid startTime or endTime' }, { status: 400 })
  }
  if (start <= new Date()) {
    return NextResponse.json({ error: 'startTime must be in the future' }, { status: 400 })
  }

  // Enforce resource booking window (e.g. can't book more than 90 days out).
  if (resource.bookingWindowDays) {
    const maxStart = new Date(Date.now() + resource.bookingWindowDays * 86400000)
    if (start >= maxStart) {
      return NextResponse.json({ error: `Bookings must start within ${resource.bookingWindowDays} days` }, { status: 400 })
    }
  }

  // Enforce max booking duration (e.g. can't book more than 8 hours).
  if (resource.maxBookingHours) {
    const hours = (end.getTime() - start.getTime()) / 3600000
    if (hours > resource.maxBookingHours) {
      return NextResponse.json({ error: `Booking exceeds max ${resource.maxBookingHours} hours` }, { status: 400 })
    }
  }

  // Race-safe conflict check + create: re-run the conflict query inside the
  // transaction so two concurrent POSTs can't both pass an empty conflict
  // check and create overlapping bookings.
  const booking = await db.$transaction(async (tx) => {
    const conflicts = await tx.resourceBooking.findFirst({
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
      return { kind: 'conflict' as const }
    }

    const created = await tx.resourceBooking.create({
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
    return { kind: 'ok' as const, booking: created }
  })

  if (booking.kind === 'conflict') {
    return NextResponse.json({ error: 'Time conflicts with existing booking' }, { status: 409 })
  }

  return NextResponse.json(booking.booking)
}
