import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/rsvp?eventId=... OR ?userId=...
// userId is always the signed-in user (IDOR guard).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const eventId = url.searchParams.get('eventId')
  // Ignore userId from query — always use the signed-in user.
  const userId = user.id

  const where: any = {}
  if (eventId) where.eventId = eventId
  // If no eventId given, scope to the signed-in user's RSVPs only.
  if (!eventId) where.userId = userId
  // If eventId is given, verify the caller can read the event's club
  // (so non-members can't enumerate RSVPs for arbitrary events).
  if (eventId) {
    const event = await db.event.findUnique({ where: { id: eventId }, select: { clubId: true } })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (!hasPermission(user, 'club:read', event.clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const rsvps = await db.eventRSVP.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Summary
  const summary = {
    going: rsvps.filter(r => r.status === 'GOING').reduce((s, r) => s + r.partySize, 0),
    maybe: rsvps.filter(r => r.status === 'MAYBE').length,
    notGoing: rsvps.filter(r => r.status === 'NOT_GOING').length,
    waitlist: rsvps.filter(r => r.status === 'WAITLIST').length,
  }

  return NextResponse.json({ rsvps, summary })
}

// Create / update RSVP — always for the signed-in user.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  // Verify the caller can read the event's club (members can RSVP; visitors
  // should use the /api/rsvp/public endpoint instead).
  const event = await db.event.findUnique({ where: { id: body.eventId }, select: { clubId: true, title: true, capacity: true, _count: { select: { rsvps: true } } } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Upsert — always keyed on the signed-in user's ID.
  const existing = await db.eventRSVP.findUnique({
    where: { eventId_userId: { eventId: body.eventId, userId: user.id } },
  })

  let rsvp
  if (existing) {
    rsvp = await db.eventRSVP.update({
      where: { id: existing.id },
      data: { status: body.status, partySize: body.partySize || 1, notes: body.notes || null },
    })
  } else {
    rsvp = await db.eventRSVP.create({
      data: {
        eventId: body.eventId,
        userId: user.id,  // always the signed-in user
        status: body.status,
        partySize: body.partySize || 1,
        notes: body.notes || null,
      },
    })
  }

  // Fire webhook on RSVP creation (not on update)
  if (!existing && body.status === 'GOING' && event) {
    emitWebhook(event.clubId, 'rsvp.created', {
      eventId: body.eventId, userId: user.id, status: body.status,
      eventTitle: event.title, totalRsvps: event._count.rsvps, capacity: event.capacity,
    }).catch(() => {})
  }

  return NextResponse.json(rsvp)
}
