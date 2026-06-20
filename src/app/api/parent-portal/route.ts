import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/parent-portal?token=...
 * Returns the parent's students + their attendance summary.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const tokenRow = await db.parentPortalToken.findUnique({
    where: { token },
    include: {
      parent: {
        select: { id: true, name: true, email: true },
      },
    },
  })
  if (!tokenRow) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Token expired' }, { status: 400 })
  }

  // Touch last used
  await db.parentPortalToken.update({
    where: { id: tokenRow.id },
    data: { lastUsedAt: new Date() },
  })

  // Get all students this parent has
  const guardianships = await db.parentGuardian.findMany({
    where: { parentId: tokenRow.parentId },
    include: {
      student: {
        select: {
          id: true, name: true, email: true, grade: true, graduationYear: true, house: true,
        },
      },
    },
  })

  const students = await Promise.all(guardianships.map(async (g) => {
    const memberships = await db.membership.findMany({
      where: { userId: g.studentId, status: 'ACTIVE' },
      include: {
        club: { select: { id: true, name: true, primaryColor: true } },
      },
    })

    const clubData = await Promise.all(memberships.map(async (m) => {
      const attendances = await db.attendance.findMany({
        where: { userId: g.studentId, event: { clubId: m.clubId } },
        include: { event: { select: { title: true, startTime: true, type: true } } },
        orderBy: { event: { startTime: 'desc' } },
        take: 30,
      })
      const present = attendances.filter(a => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
      const rate = attendances.length ? (present / attendances.length) : 0

      const upcomingEvents = await db.event.findMany({
        where: { clubId: m.clubId, startTime: { gte: new Date() }, status: 'SCHEDULED' },
        orderBy: { startTime: 'asc' },
        take: 5,
        select: { id: true, title: true, startTime: true, endTime: true, location: true, isRequired: true },
      })

      const announcements = await db.announcement.findMany({
        where: { clubId: m.clubId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, title: true, content: true, createdAt: true, priority: true, category: true },
      })

      return {
        club: m.club,
        membership: { role: m.role, points: m.points, streak: m.streak },
        attendance: { rate, present, total: attendances.length, recent: attendances.slice(0, 10) },
        upcomingEvents,
        announcements,
      }
    }))

    return {
      student: g.student,
      relationship: g.relationship,
      canExcuseAbsences: g.canExcuseAbsences,
      clubs: clubData,
    }
  }))

  return NextResponse.json({ parent: tokenRow.parent, students })
}
