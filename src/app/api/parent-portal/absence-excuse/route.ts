import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clampStr, LIMITS } from '@/lib/clubhub/sanitize'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, eventId, userId, reason, description } = body
  if (!token || !eventId || !userId || !reason) return NextResponse.json({ error: 'token, eventId, userId, reason required' }, { status: 400 })

  const safeReason = clampStr(reason, 200)
  const safeDescription = description ? clampStr(description, LIMITS.DESCRIPTION) : null

  const tokenRow = await db.parentPortalToken.findUnique({ where: { token } })
  if (!tokenRow) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) return NextResponse.json({ error: 'Token expired' }, { status: 400 })

  const guardianship = await db.parentGuardian.findUnique({
    where: { parentId_studentId: { parentId: tokenRow.parentId, studentId: userId } },
  })
  if (!guardianship) return NextResponse.json({ error: 'Not authorized for this student' }, { status: 403 })
  if (!guardianship.canExcuseAbsences) return NextResponse.json({ error: 'You do not have permission to excuse absences for this student' }, { status: 403 })

  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  // Create excuse as PENDING — officer review required via PATCH /api/attendance-excuses/[id]
  const excuse = await db.attendanceExcuse.create({
    data: {
      eventId, userId, reason: safeReason, description: safeDescription,
      submittedById: tokenRow.parentId, status: 'PENDING',
    },
  })

  const leaders = await db.membership.findMany({
    where: { clubId: event.clubId, role: { in: ['PRESIDENT', 'VICE_PRESIDENT', 'COMMITTEE_HEAD'] } },
    select: { userId: true },
  })
  const club = await db.club.findUnique({ where: { id: event.clubId }, select: { advisorId: true } })
  const leaderIds = new Set(leaders.map(l => l.userId))
  if (club?.advisorId) leaderIds.add(club.advisorId)
  const parent = await db.user.findUnique({ where: { id: tokenRow.parentId }, select: { name: true } })
  const student = await db.user.findUnique({ where: { id: userId }, select: { name: true } })

  await Promise.all(Array.from(leaderIds).map((uid) =>
    db.notification.create({
      data: {
        userId: uid, clubId: event.clubId, type: 'ATTENDANCE_EXCUSE',
        title: `Absence excuse submitted for ${student?.name}`,
        body: `${parent?.name} (parent/guardian) submitted an excuse for ${student?.name} from "${event.title}" — reason: ${safeReason}. Review pending.`,
        link: `/api/events?id=${eventId}`,
      },
    }).catch(() => {})
  ))

  return NextResponse.json({ ok: true, excuse })
}
