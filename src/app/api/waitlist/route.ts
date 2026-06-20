import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'

// GET /api/waitlist?eventId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('eventId')
  const where: any = {}
  if (eventId) where.eventId = eventId
  const waitlist = await db.eventWaitlist.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ waitlist })
}

// POST /api/waitlist — join the waitlist for a full event
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, userId, name, email, phone, notes } = body
  if (!eventId || (!userId && !email)) {
    return NextResponse.json({ error: 'eventId and either userId or email required' }, { status: 400 })
  }

  // Check that event is actually at capacity
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { rsvps: true, waitlist: true } } },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Allow joining waitlist even if not yet at capacity (user choice)
  const entry = await db.eventWaitlist.create({
    data: {
      eventId,
      userId: userId || null,
      name: name || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
    }
  })

  return NextResponse.json({ waitlist: entry, position: event._count.waitlist + 1 })
}

/**
 * PATCH /api/waitlist — promote the next person when a spot opens.
 * Body: { eventId } — finds the next person in line, sends them a "spot opened" email.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { eventId } = body
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

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
