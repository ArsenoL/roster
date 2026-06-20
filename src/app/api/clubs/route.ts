import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

// POST /api/clubs — create a new club
export async function POST(req: NextRequest) {
  const body = await req.json()
  const club = await db.club.create({
    data: {
      name: body.name,
      description: body.description || null,
      category: body.category || 'OTHER',
      primaryColor: body.primaryColor || '#10b981',
      accentColor: body.accentColor || '#6366f1',
      advisorId: body.advisorId || null,
      presidentId: body.presidentId || null,
      meetingRoom: body.meetingRoom || null,
      defaultDay: body.defaultDay || null,
      defaultTime: body.defaultTime || null,
      capacity: body.capacity || 50,
      dues: body.dues || 0,
      isPublic: body.isPublic ?? true,
      requireApproval: body.requireApproval ?? false,
    },
    include: {
      advisor: { select: { id: true, name: true } },
      president: { select: { id: true, name: true } },
    }
  })
  // create settings row
  await db.clubSetting.create({ data: { clubId: club.id } })
  // audit log
  await db.auditLog.create({
    data: { action: 'create', entity: 'Club', entityId: club.id, clubId: club.id, after: JSON.stringify(club) }
  })
  return NextResponse.json({ club })
}
