import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook } from '@/lib/clubhub/dispatchers'

/**
 * GET /api/rsvp/public?token=...
 * Returns event info for the public RSVP page (no auth required).
 * The token is the event ID (for simplicity) — in production this would be
 * a separate signed token but event IDs are cuid so they're unguessable.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      club: { select: { id: true, name: true, primaryColor: true } },
      _count: { select: { rsvps: true } },
    },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (event.status === 'CANCELLED') return NextResponse.json({ error: 'Event cancelled' }, { status: 410 })

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      meetingLink: event.meetingLink,
      capacity: event.capacity,
      isRequired: event.isRequired,
      type: event.type,
      club: event.club,
      rsvpCount: event._count.rsvps,
      isFull: event.capacity ? event._count.rsvps >= event.capacity : false,
    },
  })
}

/**
 * POST /api/rsvp/public
 * Body: { eventId, name, email, status, partySize?, notes? }
 * Public RSVP — no auth required (used by /rsvp/[eventId] landing page).
 * Finds/creates user by email, then creates RSVP + waitlist entry if full.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, name, email, status, partySize, notes } = body
  if (!eventId || !email || !status) {
    return NextResponse.json({ error: 'eventId, email, status required' }, { status: 400 })
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { club: true, _count: { select: { rsvps: true } } },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Find or create user
  let user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        role: 'GUEST',
      },
    })
  }

  // Check capacity
  const isFull = event.capacity && event._count.rsvps >= event.capacity
  if (isFull && status === 'GOING') {
    // Add to waitlist instead
    const wl = await db.eventWaitlist.create({
      data: {
        eventId,
        userId: user.id,
        name: user.name,
        email: user.email,
        notes: notes || null,
      }
    })
    return NextResponse.json({
      status: 'WAITLIST',
      message: 'Event is full — you\'ve been added to the waitlist',
      position: event._count.rsvps + 1,
      waitlist: wl,
    })
  }

  // Upsert RSVP
  const existing = await db.eventRSVP.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
  })
  let rsvp
  if (existing) {
    rsvp = await db.eventRSVP.update({
      where: { id: existing.id },
      data: { status, partySize: partySize || 1, notes: notes || null },
    })
  } else {
    rsvp = await db.eventRSVP.create({
      data: {
        eventId,
        userId: user.id,
        status,
        partySize: partySize || 1,
        notes: notes || null,
      },
    })
  }

  emitWebhook(event.clubId, 'rsvp.created', {
    eventId, userId: user.id, status, source: 'public',
  }).catch(() => {})

  return NextResponse.json({ status: 'OK', rsvp, user: { id: user.id, name: user.name, email: user.email } })
}
