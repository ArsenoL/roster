import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook, pushNotification } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { clampStr, LIMITS } from '@/lib/clubhub/sanitize'
import { randomInt } from 'crypto'

const KIOSK_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const KIOSK_CODE_RE = /^[A-Z2-9]{6}$/

function generateShortCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += KIOSK_CHARS[randomInt(0, KIOSK_CHARS.length)]
  return code
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { eventId } = body
  if (!eventId) return NextResponse.json({ error: 'eventId required' }, { status: 400 })

  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!hasPermission(user, 'events:write', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const code = generateShortCode()
  const metadata = JSON.parse(event.metadata || '{}')
  metadata.kioskCode = code
  metadata.kioskCodeSetAt = new Date().toISOString()
  metadata.kioskCodeSetBy = user.id

  await db.event.update({ where: { id: eventId }, data: { metadata: JSON.stringify(metadata) } })
  return NextResponse.json({ code, eventId })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = (url.searchParams.get('code') || '').toUpperCase().trim()
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
  if (!KIOSK_CODE_RE.test(code)) return NextResponse.json({ error: 'Invalid code' }, { status: 400 })

  const events = await db.event.findMany({
    where: { metadata: { contains: `"kioskCode":"${code}"` } },
    include: { club: { select: { id: true, name: true, primaryColor: true } }, _count: { select: { attendances: true } } },
    take: 5,
  })

  const matching = events.filter((e) => {
    try { return (JSON.parse(e.metadata || '{}').kioskCode || '').toUpperCase() === code }
    catch { return false }
  })

  if (matching.length === 0) return NextResponse.json({ error: 'Invalid code' }, { status: 404 })
  const event = matching[0]
  return NextResponse.json({
    event: { id: event.id, title: event.title, startTime: event.startTime, endTime: event.endTime, location: event.location, capacity: event.capacity, checkedIn: event._count.attendances },
    club: event.club,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const code = clampStr(body.code, 16).toUpperCase().trim()
  const email = clampStr(body.email, LIMITS.EMAIL).toLowerCase().trim()
  const name = clampStr(body.name, LIMITS.NAME) || email.split('@')[0]

  if (!KIOSK_CODE_RE.test(code)) return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  if (!code || !email) return NextResponse.json({ error: 'code and email required' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })

  const events = await db.event.findMany({
    where: { metadata: { contains: `"kioskCode":"${code}"` } },
    include: { club: true },
    take: 5,
  })
  const event = events.find((e) => {
    try { return (JSON.parse(e.metadata || '{}').kioskCode || '').toUpperCase() === code }
    catch { return false }
  })
  if (!event) return NextResponse.json({ error: 'Invalid code' }, { status: 404 })

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ ok: false, message: `No account found for ${email}. See a club officer to be added to the roster before checking in.` }, { status: 403 })
  }

  const membership = await db.membership.findUnique({ where: { userId_clubId: { userId: user.id, clubId: event.clubId } } })
  if (!membership || membership.status !== 'ACTIVE') {
    return NextResponse.json({ ok: false, message: `You're not an active member of ${event.club.name}. See a club officer to be added.` }, { status: 403 })
  }

  const existing = await db.attendance.findUnique({ where: { eventId_userId: { eventId: event.id, userId: user.id } } })
  if (existing && existing.checkInTime) {
    return NextResponse.json({
      ok: false, alreadyCheckedIn: true,
      message: `${user.name}, you're already checked in!`,
      user: { name: user.name, email: user.email },
      event: { title: event.title, startTime: event.startTime },
    })
  }

  const now = new Date()
  const lateThreshold = new Date(event.startTime.getTime() + 15 * 60000)
  const isLate = now > lateThreshold
  const status = isLate ? 'LATE' : 'PRESENT'
  const points = isLate ? 3 : 5

  await db.$transaction([
    db.checkIn.create({ data: { eventId: event.id, userId: user.id, type: 'check-in', method: 'KIOSK', timestamp: now } }),
    db.attendance.upsert({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
      create: { eventId: event.id, userId: user.id, status, method: 'KIOSK', checkInTime: now, pointsEarned: points },
      update: { status, method: 'KIOSK', checkInTime: now, pointsEarned: points },
    }),
    db.membership.update({
      where: { id: membership.id },
      data: {
        points: { increment: points },
        streak: { increment: 1 },
        longestStreak: Math.max(membership.longestStreak, membership.streak + 1),
      },
    }),
  ])

  emitWebhook(event.clubId, 'attendance.checked_in', {
    eventId: event.id, eventTitle: event.title, userId: user.id, userName: user.name, status, method: 'KIOSK', checkedInAt: now.toISOString(),
  }).catch(() => {})

  pushNotification({
    userId: user.id, clubId: event.clubId, type: 'CHECK_IN',
    title: `Checked in to ${event.title}`,
    body: `You're marked as ${status.toLowerCase()}${isLate ? ' (late)' : ''}. +${points} points earned.`,
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    message: `${user.name}, you're checked in${isLate ? ' (late)' : ''}! +${points} points`,
    user: { name: user.name, email: user.email },
    event: { title: event.title, startTime: event.startTime, location: event.location },
    status, points, streak: membership.streak + 1,
  })
}
