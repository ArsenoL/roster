import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook } from '@/lib/clubhub/dispatchers'
import { clampStr, LIMITS } from '@/lib/clubhub/sanitize'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { club: { select: { id: true, name: true, primaryColor: true, isPublic: true } }, _count: { select: { rsvps: true } } },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (event.status === 'CANCELLED') return NextResponse.json({ error: 'Event cancelled' }, { status: 410 })

  const user = await getCurrentUser()
  const hasSessionAccess = user && hasPermission(user, 'club:read', event.club.id)
  if (!hasSessionAccess && !event.club.isPublic) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    event: {
      id: event.id, title: event.title, description: event.description,
      startTime: event.startTime, endTime: event.endTime, location: event.location,
      // meetingLink intentionally omitted
      capacity: event.capacity, isRequired: event.isRequired, type: event.type,
      club: event.club, rsvpCount: event._count.rsvps,
      isFull: event.capacity ? event._count.rsvps >= event.capacity : false,
    },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, name, email, status, partySize, notes } = body
  if (!eventId || !email || !status) return NextResponse.json({ error: 'eventId, email, status required' }, { status: 400 })
  const emailLower = clampStr(email, LIMITS.EMAIL).toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  const safeName = clampStr(name, LIMITS.NAME) || emailLower.split('@')[0]
  const safeNotes = clampStr(notes, LIMITS.NOTES) || null
  const safeStatus = ['GOING', 'MAYBE', 'NOT_GOING'].includes(status) ? status : 'GOING'
  const partyNum = Number.isFinite(partySize) && partySize > 0 && partySize <= 10 ? Math.floor(partySize) : 1

  try {
    const result = await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { club: true, _count: { select: { rsvps: true } } },
      })
      if (!event) throw { status: 404, message: 'Event not found' }

      if (!event.club.isPublic) {
        const user = await getCurrentUser()
        if (!user || !hasPermission(user, 'club:read', event.club.id)) {
          throw { status: 403, message: 'Forbidden' }
        }
      }

      const existingUser = await tx.user.findUnique({ where: { email: emailLower } })
      const userId = existingUser?.id || null

      const isFull = event.capacity && event._count.rsvps >= event.capacity
      if (isFull && safeStatus === 'GOING') {
        const wl = await tx.eventWaitlist.create({
          data: { eventId, userId, name: safeName, email: emailLower, notes: safeNotes },
        })
        return { kind: 'waitlist' as const, wl, position: event._count.rsvps + 1 }
      }

      if (!userId) {
        const wl = await tx.eventWaitlist.create({
          data: { eventId, userId: null, name: safeName, email: emailLower, notes: safeNotes },
        })
        return { kind: 'waitlist' as const, wl, position: event._count.rsvps + 1, anonymous: true as const }
      }

      const existingRsvp = await tx.eventRSVP.findUnique({ where: { eventId_userId: { eventId, userId } } })
      let rsvp
      if (existingRsvp) {
        rsvp = await tx.eventRSVP.update({
          where: { id: existingRsvp.id },
          data: { status: safeStatus, partySize: partyNum, notes: safeNotes },
        })
      } else {
        rsvp = await tx.eventRSVP.create({
          data: { eventId, userId, status: safeStatus, partySize: partyNum, notes: safeNotes },
        })
      }
      return { kind: 'rsvp' as const, rsvp, userId }
    })

    if (result.kind === 'waitlist') {
      return NextResponse.json({ status: 'WAITLIST', message: 'Event is full — you\'ve been added to the waitlist', position: result.position, waitlist: result.wl })
    }

    db.event.findUnique({ where: { id: eventId }, select: { clubId: true } })
      .then(ev => ev && emitWebhook(ev.clubId, 'rsvp.created', { eventId, userId: result.userId, status: safeStatus, source: 'public' }))
      .catch(() => {})

    return NextResponse.json({ status: 'OK', rsvp: result.rsvp, user: result.userId ? { id: result.userId } : null })
  } catch (e: any) {
    if (e && typeof e === 'object' && 'status' in e) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'RSVP failed' }, { status: 500 })
  }
}
