import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CORE_MODULES } from '@/lib/clubhub/modules'
import { getCurrentUser } from '@/lib/clubhub/auth'

// GET /api/clubs — list all clubs (with member/event counts)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category')
  const search = url.searchParams.get('search')

  const where: any = {}
  if (category && category !== 'ALL') where.category = category
  if (search) where.name = { contains: search }

  const clubs = await db.club.findMany({
    where,
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      president: { select: { id: true, name: true } },
      _count: { select: { members: true, events: true, announcements: true } },
    },
    orderBy: { name: 'asc' },
  })

  // For each club, compute attendance rate and active members
  const enriched = await Promise.all(clubs.map(async (c) => {
    const activeMembers = await db.membership.count({ where: { clubId: c.id, status: 'ACTIVE' } })
    const totalAttendance = await db.attendance.count({
      where: { event: { clubId: c.id }, status: { in: ['PRESENT', 'LATE', 'VIRTUAL'] } }
    })
    const totalRecords = await db.attendance.count({ where: { event: { clubId: c.id } } })
    const attendanceRate = totalRecords > 0 ? (totalAttendance / totalRecords) * 100 : 0
    return {
      ...c,
      activeMembers,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      totalEvents: c._count.events,
      totalAnnouncements: c._count.announcements,
    }
  }))

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
  const club = await db.club.create({
    data: {
      name,
      description: body.description || null,
      category: body.category || 'OTHER',
      primaryColor: body.primaryColor || '#d6543e',   // coral (matches --vibrant)
      accentColor: body.accentColor || '#2a9d8f',     // teal (matches --vibrant-2)
      advisorId: body.advisorId || null,
      presidentId: user.id,  // creator is the president
      meetingRoom: body.meetingRoom || null,
      defaultDay: body.defaultDay || null,
      defaultTime: body.defaultTime || null,
      capacity: body.capacity || 50,
      dues: body.dues || 0,
      isPublic: body.isPublic ?? true,
      requireApproval: body.requireApproval ?? false,
      // New clubs get the Core 3 by default unless the caller passes an
      // explicit modules array (e.g. from onboarding picker).
      modules: JSON.stringify(body.modules ?? CORE_MODULES),
    },
    include: {
      advisor: { select: { id: true, name: true } },
      president: { select: { id: true, name: true } },
    }
  })

  // Auto-enroll the creator as PRESIDENT of the new club.
  // upsert guards against the (extremely unlikely) case where a Membership
  // row for this user+club already exists from a prior partial run.
  await db.membership.upsert({
    where: { userId_clubId: { userId: user.id, clubId: club.id } },
    create: {
      userId: user.id,
      clubId: club.id,
      role: 'PRESIDENT',
      status: 'ACTIVE',
    },
    update: {
      role: 'PRESIDENT',
      status: 'ACTIVE',
      leftAt: null,
    },
  })

  // If the user was a GUEST (auto-created on first magic-link sign-in),
  // upgrade their global role so they have full club-leader permissions
  // across the product (insights, audit, integrations, etc.).
  if (user.role === 'GUEST') {
    await db.user.update({
      where: { id: user.id },
      data: { role: 'CLUB_LEADER' },
    })
  }

  // Seed default settings row
  await db.clubSetting.create({ data: { clubId: club.id } })

  // Audit log
  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'Club',
      entityId: club.id,
      clubId: club.id,
      userId: user.id,
      after: JSON.stringify(club),
    }
  })

  return NextResponse.json({ club })
}
