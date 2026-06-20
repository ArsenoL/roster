import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/parent-portal/absence-excuse
 * Body: { token, eventId, userId, reason, description }
 * Parent submits an absence excuse for their child.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, eventId, userId, reason, description } = body
  if (!token || !eventId || !userId || !reason) {
    return NextResponse.json({ error: 'token, eventId, userId, reason required' }, { status: 400 })
  }

  // Verify token + relationship
  const tokenRow = await db.parentPortalToken.findUnique({ where: { token } })
  if (!tokenRow) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const guardianship = await db.parentGuardian.findUnique({
    where: { parentId_studentId: { parentId: tokenRow.parentId, studentId: userId } },
  })
  if (!guardianship) {
    return NextResponse.json({ error: 'Not authorized for this student' }, { status: 403 })
  }
  if (!guardianship.canExcuseAbsences) {
    return NextResponse.json({ error: 'You do not have permission to excuse absences for this student' }, { status: 403 })
  }

  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Create excuse record
  const excuse = await db.attendanceExcuse.create({
    data: {
      eventId,
      userId,
      reason,
      description: description || null,
      submittedById: tokenRow.parentId,
      status: 'PENDING',
    }
  })

  // Update attendance record to EXCUSED (auto-approved if parent has permission)
  const attendance = await db.attendance.findUnique({
    where: { eventId_userId: { eventId, userId } },
  })
  if (attendance) {
    await db.attendance.update({
      where: { id: attendance.id },
      data: { status: 'EXCUSED' },
    })
  } else {
    await db.attendance.create({
      data: {
        eventId, userId, status: 'EXCUSED', method: 'PARENT_EXCUSE', pointsEarned: 0,
      },
    })
  }

  await db.attendanceExcuse.update({
    where: { id: excuse.id },
    data: { status: 'APPROVED', approvedById: tokenRow.parentId, reviewedAt: new Date() },
  })

  // Notify club leaders
  const leaders = await db.membership.findMany({
    where: { clubId: event.clubId, role: { in: ['PRESIDENT', 'VICE_PRESIDENT', 'ADVISOR', 'COMMITTEE_HEAD'] } },
    select: { userId: true },
  })
  const parent = await db.user.findUnique({ where: { id: tokenRow.parentId }, select: { name: true } })
  const student = await db.user.findUnique({ where: { id: userId }, select: { name: true } })

  await Promise.all(leaders.map((l) =>
    db.notification.create({
      data: {
        userId: l.userId,
        clubId: event.clubId,
        type: 'ATTENDANCE_EXCUSE',
        title: `Absence excused for ${student?.name}`,
        body: `${parent?.name} (parent/guardian) excused ${student?.name} from "${event.title}" — reason: ${reason}.`,
        link: `/api/events?id=${eventId}`,
      },
    }).catch(() => {})
  ))

  return NextResponse.json({ ok: true, excuse })
}
