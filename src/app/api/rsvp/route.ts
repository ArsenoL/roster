import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook } from '@/lib/clubhub/dispatchers'

// GET /api/rsvp?eventId=...  OR  ?userId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('eventId')
  const userId = url.searchParams.get('userId')

  const where: any = {}
  if (eventId) where.eventId = eventId
  if (userId) where.userId = userId

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

// Create / update RSVP
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Upsert
  const existing = await db.eventRSVP.findUnique({
    where: { eventId_userId: { eventId: body.eventId, userId: body.userId } },
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
        userId: body.userId,
        status: body.status,
        partySize: body.partySize || 1,
        notes: body.notes || null,
      },
    })
  }

  // Fire webhook on RSVP creation (not on update)
  if (!existing && body.status === 'GOING') {
    const event = await db.event.findUnique({
      where: { id: body.eventId },
      select: { clubId: true, title: true, capacity: true, _count: { select: { rsvps: true } } },
    })
    if (event) {
      emitWebhook(event.clubId, 'rsvp.created', {
        eventId: body.eventId, userId: body.userId, status: body.status,
        eventTitle: event.title, totalRsvps: event._count.rsvps, capacity: event.capacity,
      }).catch(() => {})
    }
  }

  return NextResponse.json(rsvp)
}
