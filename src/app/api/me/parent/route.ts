import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/clubhub/auth'

/**
 * GET /api/me/parent
 * Returns data for the parent dashboard: their children + each child's
 * attendance, clubs, upcoming events, and recent excuses.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all students this parent is linked to
  const links = await db.parentGuardian.findMany({
    where: { parentId: user.id },
    include: {
      student: {
        select: {
          id: true, name: true, email: true, grade: true, graduationYear: true,
          house: true, pronouns: true,
        },
      },
    },
  })

  if (links.length === 0) {
    return NextResponse.json({
      parent: { id: user.id, name: user.name, email: user.email },
      children: [],
      message: 'No linked students yet. Ask your school administrator to link your account to your child.',
    })
  }

  // For each child, fetch clubs, attendance stats, upcoming events
  const children = await Promise.all(links.map(async (link) => {
    const student = link.student

    const [memberships, attendance, upcomingEvents, recentExcuses] = await Promise.all([
      db.membership.findMany({
        where: { userId: student.id, status: 'ACTIVE' },
        include: {
          club: {
            select: {
              id: true, name: true, category: true, primaryColor: true,
              meetingRoom: true, defaultDay: true, defaultTime: true, slug: true,
              advisor: { select: { name: true, email: true } },
            },
          },
        },
      }),

      db.attendance.findMany({
        where: { userId: student.id },
        include: {
          event: { select: { id: true, title: true, startTime: true, clubId: true, club: { select: { id: true, name: true, primaryColor: true } } } },
        },
        orderBy: { event: { startTime: 'desc' } },
        take: 200,
      }),

      db.event.findMany({
        where: {
          startTime: { gte: new Date() },
          club: { members: { some: { userId: student.id, status: 'ACTIVE' } } },
          status: 'SCHEDULED',
        },
        include: {
          club: { select: { id: true, name: true, primaryColor: true } },
        },
        orderBy: { startTime: 'asc' },
        take: 8,
      }),

      db.attendanceExcuse.findMany({
        where: { userId: student.id },
        include: {
          event: { select: { id: true, title: true, startTime: true, club: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])

    // Compute stats
    const totalRecords = attendance.length
    const attended = attendance.filter(a => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
    const rate = totalRecords > 0 ? Math.round((attended / totalRecords) * 1000) / 10 : 0

    const statusBreakdown: Record<string, number> = {}
    attendance.forEach(a => {
      statusBreakdown[a.status] = (statusBreakdown[a.status] || 0) + 1
    })

    return {
      link,
      student,
      clubs: memberships.map(m => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        club: m.club,
      })),
      attendanceStats: {
        total: totalRecords,
        attended,
        rate,
        statusBreakdown,
      },
      recentAttendance: attendance.slice(0, 5),
      upcomingEvents,
      recentExcuses,
    }
  }))

  return NextResponse.json({
    parent: { id: user.id, name: user.name, email: user.email },
    children,
  })
}
