import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/clubhub/auth'

/**
 * GET /api/me
 * Returns the signed-in user's personal dashboard data:
 *   - profile
 *   - memberships (with club stats)
 *   - attendance stats (per-club + overall)
 *   - upcoming events across all their clubs
 *   - recent badges
 *   - pending tasks / forms / RSVPs
 *   - streak, points, engagement score
 *
 * This is the data powering /app/me (student dashboard).
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const inFourteenDays = new Date()
  inFourteenDays.setDate(inFourteenDays.getDate() + 14)

  const [
    memberships,
    attendanceRows,
    upcomingEvents,
    recentBadges,
    pendingTasks,
    pendingForms,
    pendingRsvps,
    volunteerHours,
    transactions,
    statusBreakdownRows,
  ] = await Promise.all([
    // All active memberships
    db.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: {
        club: {
          select: {
            id: true, name: true, category: true, primaryColor: true, accentColor: true,
            meetingRoom: true, defaultDay: true, defaultTime: true, slug: true,
            advisor: { select: { name: true } },
            president: { select: { name: true } },
            _count: { select: { members: true, events: true } },
          },
        },
      },
    }),

    // All attendance records for this user (across all clubs). Capped at
    // 200 to bound response size — the previous 500-row fetch was overkill
    // for the dashboard surface.
    db.attendance.findMany({
      where: { userId: user.id },
      include: {
        event: {
          select: {
            id: true, title: true, startTime: true, endTime: true, location: true,
            type: true, clubId: true, club: { select: { id: true, name: true, primaryColor: true } },
          },
        },
      },
      orderBy: { event: { startTime: 'desc' } },
      take: 200,
    }),

    // Upcoming events across all the user's clubs
    db.event.findMany({
      where: {
        startTime: { gte: new Date() },
        club: { members: { some: { userId: user.id, status: 'ACTIVE' } } },
        status: 'SCHEDULED',
      },
      include: {
        club: { select: { id: true, name: true, primaryColor: true } },
        _count: { select: { attendances: true, rsvps: true } },
        rsvps: { where: { userId: user.id }, select: { id: true, status: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    }),

    // Recent badges
    db.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
      take: 12,
    }),

    // Pending tasks assigned to this user
    db.task.findMany({
      where: {
        assigneeId: user.id,
        status: { in: ['TODO', 'IN_PROGRESS'] },
      },
      include: {
        club: { select: { id: true, name: true, primaryColor: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),

    // Pending form responses — forms that are OPEN with a future deadline, no response from this user
    db.form.findMany({
      where: {
        club: { members: { some: { userId: user.id, status: 'ACTIVE' } } },
        status: 'OPEN',
        deadline: { gt: new Date() },
        responses: { none: { userId: user.id } },
      },
      include: {
        club: { select: { id: true, name: true, primaryColor: true } },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    }),

    // Upcoming events without RSVP from this user
    db.event.findMany({
      where: {
        startTime: { gte: new Date(), lte: inFourteenDays },
        club: { members: { some: { userId: user.id, status: 'ACTIVE' } } },
        rsvps: { none: { userId: user.id } },
      },
      include: {
        club: { select: { id: true, name: true, primaryColor: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    }),

    // Volunteer hours
    db.volunteerHours.findMany({
      where: { userId: user.id, status: 'APPROVED' },
      select: { hours: true, date: true, description: true },
      orderBy: { date: 'desc' },
      take: 50,
    }),

    // Recent finance transactions where this user is the recorded member
    db.transaction.findMany({
      where: { memberId: { not: undefined }, member: { userId: user.id } },
      orderBy: { date: 'desc' },
      take: 10,
    }),

    // Single groupBy query for the status breakdown — replaces the
    // multiple JS iterations over attendanceRows that the previous code
    // used to compute the same map.
    db.attendance.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: { status: true },
    }),
  ])

  // ─── Compute aggregate stats ──────────────────────────────────────────

  const totalAttendance = attendanceRows.length
  const present = attendanceRows.filter(a => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
  const attendanceRate = totalAttendance > 0 ? Math.round((present / totalAttendance) * 1000) / 10 : 0

  // Per-club attendance breakdown
  const perClub: Record<string, { clubName: string, clubColor: string, total: number, attended: number, rate: number }> = {}
  for (const a of attendanceRows) {
    const clubId = a.event.clubId
    if (!perClub[clubId]) {
      perClub[clubId] = { clubName: a.event.club.name, clubColor: a.event.club.primaryColor, total: 0, attended: 0, rate: 0 }
    }
    perClub[clubId].total++
    if (['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)) perClub[clubId].attended++
  }
  Object.values(perClub).forEach(c => { c.rate = c.total > 0 ? Math.round((c.attended / c.total) * 1000) / 10 : 0 })

  // Status breakdown — sourced from the dedicated groupBy query instead of
  // an in-JS fold over attendanceRows.
  const statusBreakdown: Record<string, number> = {}
  for (const row of statusBreakdownRows) {
    statusBreakdown[row.status] = row._count.status
  }

  // Streak: count back from most recent attended event until a gap (no attendance for >= 21 days between events)
  const attendedDates = attendanceRows
    .filter(a => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status))
    .map(a => new Date(a.event.startTime).getTime())
    .sort((a, b) => b - a)  // desc

  let streak = 0
  if (attendedDates.length > 0) {
    streak = 1
    for (let i = 1; i < attendedDates.length; i++) {
      const gap = attendedDates[i - 1] - attendedDates[i]
      const daysBetween = gap / (1000 * 60 * 60 * 24)
      if (daysBetween <= 35) streak++  // Allow up to 5 weeks between attendances
      else break
    }
  }

  // Points (from badges + a simple attendance-based calculation)
  const pointsFromBadges = recentBadges.reduce((sum, ub) => sum + (ub.badge.points || 0), 0)
  const pointsFromAttendance = present * 5
  const totalPoints = pointsFromBadges + pointsFromAttendance

  // Volunteer hours sum
  const totalVolunteerHours = volunteerHours.reduce((sum, v) => sum + v.hours, 0)

  // Recent attendance (last 5 for display)
  const recentAttendance = attendanceRows.slice(0, 5)

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    stats: {
      totalClubs: memberships.length,
      totalEvents: totalAttendance,
      attendedEvents: present,
      attendanceRate,
      streak,
      totalPoints,
      totalVolunteerHours: Math.round(totalVolunteerHours * 10) / 10,
      badgesCount: recentBadges.length,
    },
    memberships: memberships.map(m => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      club: m.club,
    })),
    perClubAttendance: Object.values(perClub),
    statusBreakdown,
    upcomingEvents,
    recentAttendance,
    badges: recentBadges,
    pendingTasks,
    pendingForms,
    pendingRsvps,
    volunteerHours: volunteerHours.slice(0, 5),
    recentTransactions: transactions,
  })
}
