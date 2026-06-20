import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook, pushNotification } from '@/lib/clubhub/dispatchers'

// POST /api/attendance/checkin
// Body: { eventId, userId, method, type: 'check-in' | 'check-out' }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { eventId, userId, method, type = 'check-in', operatorId } = body

  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Create check-in log
  const checkIn = await db.checkIn.create({
    data: {
      eventId, userId, type, method, operatorId,
      timestamp: new Date(),
    }
  })

  // Update or create attendance record
  if (type === 'check-in') {
    const isLate = event.startTime ? new Date().getTime() > event.startTime.getTime() + 15 * 60000 : false
    const status = isLate ? 'LATE' : 'PRESENT'
    const points = isLate ? 3 : 5

    const attendance = await db.attendance.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: {
        eventId, userId, status, method,
        checkInTime: new Date(),
        pointsEarned: points,
      },
      update: {
        status, method,
        checkInTime: new Date(),
        pointsEarned: points,
      },
    })

    // Increment membership streak + points (real gamification, not just a number)
    const membership = await db.membership.findUnique({
      where: { userId_clubId: { userId, clubId: event.clubId } },
    })
    if (membership) {
      const newStreak = membership.streak + 1
      await db.membership.update({
        where: { id: membership.id },
        data: {
          points: { increment: points },
          streak: newStreak,
          longestStreak: Math.max(membership.longestStreak, newStreak),
        },
      })
    }

    // Fire webhook (real integration entry point)
    emitWebhook(event.clubId, 'attendance.checked_in', {
      eventId, eventTitle: event.title, userId, status, method, checkedInAt: new Date().toISOString(),
    }).catch(() => {})

    // Notify the user (if they checked themselves in via kiosk) — confirmation
    if (operatorId === userId || !operatorId) {
      pushNotification({
        userId,
        clubId: event.clubId,
        type: 'CHECK_IN',
        title: `Checked in to ${event.title}`,
        body: `You're marked as ${status === 'LATE' ? 'late' : 'present'} for ${event.title}. +${points} points earned.`,
        link: `/api/events?id=${eventId}`,
      }).catch(() => {})
    }

    return NextResponse.json({ checkIn, attendance, status })
  } else {
    // check-out
    const attendance = await db.attendance.update({
      where: { eventId_userId: { eventId, userId } },
      data: { checkOutTime: new Date() }
    }).catch(() => null)

    return NextResponse.json({ checkIn, attendance })
  }
}
