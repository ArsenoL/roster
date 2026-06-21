import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/waitlist?eventId=...
// Reading the waitlist (which contains names + emails) requires club:read.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const eventId = url.searchParams.get('eventId')
  const where: any = {}
  if (eventId) {
    where.eventId = eventId
    const event = await db.event.findUnique({ where: { id: eventId }, select: { clubId: true } })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (!hasPermission(user, 'club:read', event.clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    // No eventId given — admins only (would otherwise leak waitlist PII).
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }
  const waitlist = await db.eventWaitlist.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ waitlist })
}

// POST /api/waitlist — join the waitlist for a full event.
// The signed-in user is the waitlist entry's owner.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { eventId, name, email, phone, notes } = body
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  // Check that event exists and the caller can read its club (members can
  // join the waitlist; visitors should use /api/rsvp/public which also handles
  // waitlist when an event is full).
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { rsvps: true, waitlist: true } } },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const entry = await db.eventWaitlist.create({
    data: {
      eventId,
      userId: user.id,  // always the signed-in user
      name: name || user.name,
      email: email || user.email,
      phone: phone || null,
      notes: notes || null,
    },
  })

  return NextResponse.json({ waitlist: entry, position: event._count.waitlist + 1 })
}

/**
 * PATCH /api/waitlist — promote the next person when a spot opens.
 * Body: { eventId } — finds the next person in line, sends them a "spot opened" email.
 * Requires events:write (officer action).
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { eventId } = body
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, startTime: true, clubId: true } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!hasPermission(user, 'events:write', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find the next unnotified person
  const next = await db.eventWaitlist.findFirst({
    where: { eventId, notifiedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  if (!next) return NextResponse.json({ promoted: false, message: 'No one on waitlist' })

  await db.eventWaitlist.update({
    where: { id: next.id },
    data: { notifiedAt: new Date() },
  })

  if (next.email) {
    await enqueueEmail({
      toEmail: next.email,
      toName: next.name || undefined,
      subject: `A spot opened up: ${event.title}`,
      body: `<p>Good news! A spot has opened up for <strong>${event.title}</strong> on ${new Date(event.startTime).toLocaleString()}.</p>
             <p>Reply to this email or click the event link to confirm your attendance.</p>`,
      clubId: event.clubId,
    })
  }

  return NextResponse.json({ promoted: true, entry: next })
}
