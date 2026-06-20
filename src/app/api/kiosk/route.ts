import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook, pushNotification } from '@/lib/clubhub/dispatchers'

/**
 * Kiosk attendance — public check-in via an event's short code.
 *
 * GET /api/kiosk?code=ABC123
 *   Returns the event details (title, club name, start time) without exposing
 *   the eventId. Used by the /kiosk page to render a "Tap to check in" screen.
 *
 * POST /api/kiosk
 *   Body: { code, email, name? }
 *   - Look up event by short code (stored in Event.metadata as {"kioskCode":"ABC"})
 *   - Find or auto-create a User by email (status=ACTIVE, role=STUDENT)
 *   - Find or create Membership (status=ACTIVE, role=MEMBER) for the event's club
 *   - Create CheckIn + upsert Attendance (PRESENT or LATE)
 *   - Increment membership streak + points
 *   - Fire webhook + push notification
 *
 * This is intentionally open (no auth) so kiosks at the door can check people
 * in without logging in. Clubs enable kiosk check-in by setting a code on
 * their event.
 */

function generateShortCode(): string {
  // 6-char alphanumeric, ambiguous chars removed (no 0/O, 1/I/L)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

/** Generate a new kiosk code for an event. POST /api/kiosk/issue { eventId } */
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { eventId } = body
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const code = generateShortCode()
  const metadata = JSON.parse(event.metadata || '{}')
  metadata.kioskCode = code
  metadata.kioskCodeSetAt = new Date().toISOString()

  await db.event.update({
    where: { id: eventId },
    data: { metadata: JSON.stringify(metadata) },
  })

  return NextResponse.json({ code, eventId })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = (url.searchParams.get('code') || '').toUpperCase().trim()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })

  // Find event with this kiosk code
  const events = await db.event.findMany({
    where: { metadata: { contains: `"kioskCode":"${code}"` } },
    include: {
      club: { select: { id: true, name: true, primaryColor: true } },
      _count: { select: { attendances: true } },
    },
    take: 5,
  })

  // Filter to ones that actually have this exact code (defensive)
  const matching = events.filter((e) => {
    try {
      const m = JSON.parse(e.metadata || '{}')
      return (m.kioskCode || '').toUpperCase() === code
    } catch {
      return false
    }
  })

  if (matching.length === 0) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 404 })
  }

  const event = matching[0]
  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      capacity: event.capacity,
      checkedIn: event._count.attendances,
    },
    club: event.club,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const code = (body.code || '').toUpperCase().trim()
  const email = (body.email || '').toLowerCase().trim()
  const name = body.name || email.split('@')[0]

  if (!code || !email) {
    return NextResponse.json({ error: 'code and email required' }, { status: 400 })
  }

  // Find the event
  const events = await db.event.findMany({
    where: { metadata: { contains: `"kioskCode":"${code}"` } },
    include: { club: true },
    take: 5,
  })
  const event = events.find((e) => {
    try {
      const m = JSON.parse(e.metadata || '{}')
      return (m.kioskCode || '').toUpperCase() === code
    } catch {
      return false
    }
  })
  if (!event) return NextResponse.json({ error: 'Invalid code' }, { status: 404 })

  // Find or create user
  let user = await db.user.findUnique({ where: { email } })
  if (!user) {
    user = await db.user.create({
      data: { email, name, role: 'STUDENT', status: 'ACTIVE' },
    })
  }

  // Find or create membership
  let membership = await db.membership.findUnique({
    where: { userId_clubId: { userId: user.id, clubId: event.clubId } },
  })
  if (!membership) {
    membership = await db.membership.create({
      data: { userId: user.id, clubId: event.clubId, role: 'MEMBER', status: 'ACTIVE' },
    })
  }

  // Check if already checked in
  const existing = await db.attendance.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
  })
  if (existing && existing.checkInTime) {
    return NextResponse.json({
      ok: false,
      alreadyCheckedIn: true,
      message: `${user.name}, you're already checked in!`,
      user: { name: user.name, email: user.email },
      event: { title: event.title, startTime: event.startTime },
    })
  }

  // Determine late status
  const now = new Date()
  const lateThreshold = new Date(event.startTime.getTime() + 15 * 60000)
  const isLate = now > lateThreshold
  const status = isLate ? 'LATE' : 'PRESENT'
  const points = isLate ? 3 : 5

  // Create check-in log
  await db.checkIn.create({
    data: {
      eventId: event.id,
      userId: user.id,
      type: 'check-in',
      method: 'KIOSK',
      timestamp: now,
    },
  })

  // Upsert attendance
  await db.attendance.upsert({
    where: { eventId_userId: { eventId: event.id, userId: user.id } },
    create: {
      eventId: event.id,
      userId: user.id,
      status,
      method: 'KIOSK',
      checkInTime: now,
      pointsEarned: points,
    },
    update: {
      status,
      method: 'KIOSK',
      checkInTime: now,
      pointsEarned: points,
    },
  })

  // Increment gamification
  const newStreak = membership.streak + 1
  await db.membership.update({
    where: { id: membership.id },
    data: {
      points: { increment: points },
      streak: newStreak,
      longestStreak: Math.max(membership.longestStreak, newStreak),
    },
  })

  // Fire webhook + notification
  emitWebhook(event.clubId, 'attendance.checked_in', {
    eventId: event.id,
    eventTitle: event.title,
    userId: user.id,
    userName: user.name,
    status,
    method: 'KIOSK',
    checkedInAt: now.toISOString(),
  }).catch(() => {})

  pushNotification({
    userId: user.id,
    clubId: event.clubId,
    type: 'CHECK_IN',
    title: `Checked in to ${event.title}`,
    body: `You're marked as ${status.toLowerCase()}${isLate ? ' (late)' : ''}. +${points} points earned.`,
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    message: `${user.name}, you're checked in${isLate ? ' (late)' : ''}! +${points} points`,
    user: { name: user.name, email: user.email },
    event: { title: event.title, startTime: event.startTime, location: event.location },
    status,
    points,
    streak: newStreak,
  })
}
