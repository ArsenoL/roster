import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CORE_MODULES } from '@/lib/clubhub/modules'
import { getCurrentUser } from '@/lib/clubhub/auth'

// GET /api/clubs — list all clubs (with member/event counts)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const search = url.searchParams.get('search')

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN'

  const where: any = {}
  if (category && category !== 'ALL') where.category = category
  if (search) where.name = { contains: search }
  if (!isAdmin) {
    const myClubIds = user.memberships.map(m => m.clubId)
    where.OR = [
      ...(myClubIds.length > 0 ? [{ id: { in: myClubIds } }] : []),
      { isPublic: true },
    ]
  }

  const clubs = await db.club.findMany({
    where,
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      president: { select: { id: true, name: true } },
      _count: { select: { members: true, events: true, announcements: true } },
    },
    orderBy: { name: 'asc' },
    take: 500,
  })

  const clubIds = clubs.map(c => c.id)
  const [activeByClub, presentByClub, totalByClub] = await Promise.all([
    db.membership.groupBy({ by: ['clubId'], where: { clubId: { in: clubIds }, status: 'ACTIVE' }, _count: { _all: true } }),
    db.attendance.groupBy({ by: ['eventId'], where: { event: { clubId: { in: clubIds } }, status: { in: ['PRESENT', 'LATE', 'VIRTUAL'] } }, _count: { _all: true } }),
    db.attendance.groupBy({ by: ['eventId'], where: { event: { clubId: { in: clubIds } } }, _count: { _all: true } }),
  ])
  const events = await db.event.findMany({ where: { clubId: { in: clubIds } }, select: { id: true, clubId: true } })
  const eventToClub = new Map(events.map(e => [e.id, e.clubId]))
  const presentByClubMap = new Map<string, number>()
  const totalByClubMap = new Map<string, number>()
  for (const r of presentByClub) { const cid = eventToClub.get(r.eventId); if (cid) presentByClubMap.set(cid, (presentByClubMap.get(cid) || 0) + r._count._all) }
  for (const r of totalByClub) { const cid = eventToClub.get(r.eventId); if (cid) totalByClubMap.set(cid, (totalByClubMap.get(cid) || 0) + r._count._all) }
  const activeByClubMap = new Map(activeByClub.map(r => [r.clubId, r._count._all]))

  const myClubIdSet = new Set(user.memberships.map(m => m.clubId))
  const enriched = clubs.map((c) => {
    const activeMembers = activeByClubMap.get(c.id) || 0
    const totalAttendance = presentByClubMap.get(c.id) || 0
    const totalRecords = totalByClubMap.get(c.id) || 0
    const attendanceRate = totalRecords > 0 ? (totalAttendance / totalRecords) * 100 : 0
    const isMember = myClubIdSet.has(c.id)
    const advisor = isMember || isAdmin ? c.advisor : c.advisor ? { id: c.advisor.id, name: c.advisor.name } : null
    return {
      ...c, advisor, activeMembers,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      totalEvents: c._count.events, totalAnnouncements: c._count.announcements,
    }
  })

  return NextResponse.json({ clubs: enriched })
}

// POST /api/clubs — create a new club.
// Auth required. The creator is auto-enrolled as PRESIDENT of the club and
// their global role is upgraded to CLUB_LEADER if it was GUEST. This makes
// onboarding real: a brand-new user can sign in, create a club, and immediately
// land in their dashboard with full owner permissions — no admin hand-holding.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to create a club' }, { status: 401 })
  }

  const body = await req.json()
  const name = String(body.name || '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Club name is required' }, { status: 400 })
  }

  // Create the club. Default brand colors come from the civic palette
  // (coral primary, teal accent) — clubs can override in Settings → Branding.
  const club = await db.$transaction(async (tx) => {
    const created = await tx.club.create({
      data: {
        name,
        description: body.description || null,
        category: body.category || 'OTHER',
        primaryColor: body.primaryColor || '#d6543e',
        accentColor: body.accentColor || '#2a9d8f',
        advisorId: body.advisorId || null,
        presidentId: user.id,
        meetingRoom: body.meetingRoom || null,
        defaultDay: body.defaultDay || null,
        defaultTime: body.defaultTime || null,
        capacity: body.capacity || 50,
        dues: body.dues || 0,
        isPublic: body.isPublic ?? true,
        requireApproval: body.requireApproval ?? false,
        modules: JSON.stringify(body.modules ?? CORE_MODULES),
      },
      include: { advisor: { select: { id: true, name: true } }, president: { select: { id: true, name: true } } },
    })

    await tx.membership.upsert({
      where: { userId_clubId: { userId: user.id, clubId: created.id } },
      create: { userId: user.id, clubId: created.id, role: 'PRESIDENT', status: 'ACTIVE' },
      update: { role: 'PRESIDENT', status: 'ACTIVE', leftAt: null },
    })

    if (user.role === 'GUEST') {
      await tx.user.update({ where: { id: user.id }, data: { role: 'CLUB_LEADER' } })
    }

    await tx.clubSetting.create({ data: { clubId: created.id } })

    await tx.auditLog.create({
      data: { action: 'create', entity: 'Club', entityId: created.id, clubId: created.id, userId: user.id, after: JSON.stringify({ id: created.id, name: created.name }) },
    })

    return created
  })

  return NextResponse.json({ club })
}
