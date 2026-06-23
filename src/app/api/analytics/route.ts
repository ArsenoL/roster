import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/analytics?clubId=...&from=...&to=...&view=overview|trends|heatmap|retention|comparison|engagement
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'analytics')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const view = url.searchParams.get('view') || 'overview'

  // Permission check: if a specific club is requested, require club:read.
  // If no club is requested (overview), scope to clubs the user can read.
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN'
  let readableClubIds: string[] = []
  if (!isAdmin) {
    readableClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    if (clubId && clubId !== 'ALL') {
      if (!readableClubIds.includes(clubId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  const fromDate = from ? new Date(from) : new Date(Date.now() - 180 * 86400000)
  const toDate = to ? new Date(to) : new Date()

  const eventWhere: any = {
    startTime: { gte: fromDate, lte: toDate },
  }
  if (clubId && clubId !== 'ALL') {
    eventWhere.clubId = clubId
  } else if (!isAdmin) {
    eventWhere.clubId = { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] }
  }

  // ============================================================
  // OVERVIEW — KPIs + summary
  // ============================================================
  if (view === 'overview') {
    const clubCountWhere = isAdmin ? {} : { id: { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] } }
    const [totalClubs, totalMembers, totalEvents, totalAttendance, totalUsers] = await Promise.all([
      db.club.count({ where: clubCountWhere }),
      db.membership.count({ where: isAdmin ? { status: 'ACTIVE' } : { status: 'ACTIVE', clubId: { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] } } }),
      db.event.count({ where: eventWhere }),
      db.attendance.count({ where: { event: eventWhere } }),
      // Scope totalUsers to users with an ACTIVE membership in at least one
      // of the caller's readable clubs. The previous unscoped count leaked
      // every student in the system to any signed-in user. Admins (who can
      // read every club) bypass the membership filter.
      db.user.count({
        where: {
          role: 'STUDENT',
          ...(isAdmin
            ? {}
            : { memberships: { some: { status: 'ACTIVE', clubId: { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] } } } }),
        }
      }),
    ])

    const statusBreakdown = await db.attendance.groupBy({
      by: ['status'],
      where: { event: eventWhere },
      _count: { status: true },
    })
    const statusMap: Record<string, number> = {}
    statusBreakdown.forEach(s => { statusMap[s.status] = s._count.status })

    const present = (statusMap.PRESENT || 0) + (statusMap.LATE || 0) + (statusMap.VIRTUAL || 0)
    const overallRate = totalAttendance > 0 ? (present / totalAttendance) * 100 : 0

    return NextResponse.json({
      kpis: {
        totalClubs,
        totalMembers,
        totalEvents,
        totalAttendance,
        totalUsers,
        overallAttendanceRate: Math.round(overallRate * 10) / 10,
        statusBreakdown: statusMap,
      }
    })
  }

  // ============================================================
  // TRENDS — time series of attendance rate
  // ============================================================
  if (view === 'trends') {
    // Group by week
    const events = await db.event.findMany({
      where: eventWhere,
      include: { attendances: { select: { status: true } } },
      orderBy: { startTime: 'asc' },
    })

    // Bucket by ISO week
    const buckets: Record<string, { present: number, total: number, date: Date }> = {}
    for (const e of events) {
      const d = e.startTime
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const key = weekStart.toISOString().slice(0, 10)
      if (!buckets[key]) buckets[key] = { present: 0, total: 0, date: weekStart }
      for (const a of e.attendances) {
        buckets[key].total++
        if (['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)) buckets[key].present++
      }
    }

    const series = Object.entries(buckets).map(([key, v]) => ({
      date: key,
      present: v.present,
      total: v.total,
      rate: v.total > 0 ? Math.round((v.present / v.total) * 1000) / 10 : 0,
    }))

    // Per-club comparison — scope to readable clubs
    const clubFilter = isAdmin ? {} : { id: { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] } }
    const clubs = await db.club.findMany({ where: clubFilter, select: { id: true, name: true, primaryColor: true } })
    const perClub = await Promise.all(clubs.map(async (c) => {
      const clubEvents = await db.event.findMany({
        where: { clubId: c.id, startTime: { gte: fromDate, lte: toDate } },
        include: { attendances: { select: { status: true } } }
      })
      let present = 0, total = 0
      for (const e of clubEvents) {
        for (const a of e.attendances) {
          total++
          if (['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)) present++
        }
      }
      return {
        clubId: c.id,
        clubName: c.name,
        color: c.primaryColor,
        present, total,
        rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
        events: clubEvents.length,
      }
    }))

    return NextResponse.json({ timeSeries: series, perClub })
  }

  // ============================================================
  // HEATMAP — attendance by day-of-week + hour
  // ============================================================
  if (view === 'heatmap') {
    const events = await db.event.findMany({
      where: eventWhere,
      select: { startTime: true, id: true }
    })
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
    for (const e of events) {
      const dow = e.startTime.getDay()
      const hour = e.startTime.getHours()
      const cnt = await db.attendance.count({ where: { eventId: e.id, status: { in: ['PRESENT', 'LATE', 'VIRTUAL'] } } })
      matrix[dow][hour] += cnt
    }
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return NextResponse.json({ matrix, dayNames })
  }

  // ============================================================
  // RETENTION — cohort analysis by join month
  // ============================================================
  if (view === 'retention') {
    const retentionWhere = clubId && clubId !== 'ALL'
      ? { clubId }
      : !isAdmin ? { clubId: { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] } } : {}
    const memberships = await db.membership.findMany({
      where: retentionWhere,
      select: { joinedAt: true, userId: true, clubId: true, leftAt: true }
    })
    // Group by join month
    const cohorts: Record<string, { size: number, retained: number }> = {}
    for (const m of memberships) {
      const key = m.joinedAt.toISOString().slice(0, 7) // YYYY-MM
      if (!cohorts[key]) cohorts[key] = { size: 0, retained: 0 }
      cohorts[key].size++
      if (!m.leftAt) cohorts[key].retained++
    }
    const cohortData = Object.entries(cohorts).map(([month, v]) => ({
      month,
      size: v.size,
      retained: v.retained,
      retentionRate: v.size > 0 ? Math.round((v.retained / v.size) * 1000) / 10 : 0,
    })).sort((a, b) => a.month.localeCompare(b.month))
    return NextResponse.json({ cohorts: cohortData })
  }

  // ============================================================
  // ENGAGEMENT — per-member stats, at-risk members
  // ============================================================
  if (view === 'engagement') {
    const engWhere: any = clubId && clubId !== 'ALL'
      ? { clubId, status: 'ACTIVE' }
      : !isAdmin ? { status: 'ACTIVE', clubId: { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] } } : { status: 'ACTIVE' }
    const memberships = await db.membership.findMany({
      where: engWhere,
      include: {
        user: { select: { id: true, name: true, email: true, grade: true, studentId: true } },
        club: { select: { id: true, name: true, primaryColor: true } },
      },
      take: 500,
    })

    const enriched = await Promise.all(memberships.map(async (m) => {
      const stats = await db.attendance.groupBy({
        by: ['status'],
        where: { userId: m.userId, event: { clubId: m.clubId, startTime: { gte: fromDate } } },
        _count: { status: true },
      })
      const statMap: Record<string, number> = {}
      stats.forEach(s => { statMap[s.status] = s._count.status })
      const total = Object.values(statMap).reduce((a, b) => a + b, 0)
      const present = (statMap.PRESENT || 0) + (statMap.LATE || 0) + (statMap.VIRTUAL || 0)
      const rate = total > 0 ? (present / total) * 100 : 0
      // Engagement score = attendance rate * 0.5 + streak * 2 + points/10 * 0.3
      const engagementScore = Math.round((rate * 0.5 + m.streak * 2 + (m.points / 10) * 0.3) * 10) / 10
      // At-risk: rate < 50%
      const atRisk = rate < 50 && total >= 3
      return {
        ...m,
        attendanceStats: statMap,
        attendanceRate: Math.round(rate * 10) / 10,
        totalEvents: total,
        engagementScore,
        atRisk,
      }
    }))

    // Sort by engagement score
    const sorted = enriched.sort((a, b) => b.engagementScore - a.engagementScore)
    const atRiskMembers = sorted.filter(m => m.atRisk)
    const topPerformers = sorted.slice(0, 20)

    return NextResponse.json({
      members: sorted,
      atRisk: atRiskMembers,
      topPerformers,
      total: sorted.length,
      atRiskCount: atRiskMembers.length,
      avgEngagement: sorted.length > 0 ? Math.round((sorted.reduce((a, b) => a + b.engagementScore, 0) / sorted.length) * 10) / 10 : 0,
    })
  }

  // ============================================================
  // COMPARISON — club vs club on multiple metrics
  // ============================================================
  if (view === 'comparison') {
    const clubFilter = isAdmin ? {} : { id: { in: readableClubIds.length > 0 ? readableClubIds : ['__none__'] } }
    const clubs = await db.club.findMany({
      where: clubFilter,
      include: {
        _count: { select: { members: true, events: true } },
      }
    })
    const data = await Promise.all(clubs.map(async (c) => {
      const [activeMembers, totalAttendance, presentAttendance, totalEvents, badges] = await Promise.all([
        db.membership.count({ where: { clubId: c.id, status: 'ACTIVE' } }),
        db.attendance.count({ where: { event: { clubId: c.id } } }),
        db.attendance.count({ where: { event: { clubId: c.id }, status: { in: ['PRESENT', 'LATE', 'VIRTUAL'] } } }),
        db.event.count({ where: { clubId: c.id } }),
        db.userBadge.count({ where: { badge: { clubId: c.id } } }),
      ])
      const rate = totalAttendance > 0 ? (presentAttendance / totalAttendance) * 100 : 0
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        color: c.primaryColor,
        activeMembers,
        totalEvents,
        totalAttendance,
        attendanceRate: Math.round(rate * 10) / 10,
        badgesAwarded: badges,
      }
    }))
    return NextResponse.json({ clubs: data })
  }

  return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
}
