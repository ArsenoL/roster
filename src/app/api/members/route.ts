import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/members?clubId=...&search=...&role=...&grade=...&status=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const search = url.searchParams.get('search')
  const role = url.searchParams.get('role')
  const grade = url.searchParams.get('grade')
  const status = url.searchParams.get('status')
  const limit = parseInt(url.searchParams.get('limit') || '200')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const where: any = {}
  if (clubId) where.clubId = clubId
  if (role && role !== 'ALL') where.role = role
  if (status && status !== 'ALL') where.status = status
  if (search) {
    where.OR = [
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
      { user: { studentId: { contains: search } } },
    ]
  }
  if (grade && grade !== 'ALL') {
    where.user = { grade: parseInt(grade) }
  }

  const [memberships, total] = await Promise.all([
    db.membership.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, studentId: true, grade: true, graduationYear: true, house: true, pronouns: true, phone: true, avatar: true } },
        club: { select: { id: true, name: true, primaryColor: true } },
      },
      orderBy: { user: { name: 'asc' } },
      skip: offset,
      take: limit,
    }),
    db.membership.count({ where }),
  ])

  // Enrich with attendance stats
  const enriched = await Promise.all(memberships.map(async (m) => {
    const stats = await db.attendance.groupBy({
      by: ['status'],
      where: { userId: m.userId, event: { clubId: m.clubId } },
      _count: { status: true },
    })
    const statMap: Record<string, number> = {}
    stats.forEach(s => { statMap[s.status] = s._count.status })
    const total = Object.values(statMap).reduce((a, b) => a + b, 0)
    const attended = (statMap.PRESENT || 0) + (statMap.LATE || 0) + (statMap.VIRTUAL || 0)
    return {
      ...m,
      attendanceStats: statMap,
      attendanceRate: total > 0 ? Math.round((attended / total) * 1000) / 10 : 0,
      totalEvents: total,
    }
  }))

  return NextResponse.json({ members: enriched, total })
}

// POST /api/members — add a member to a club
export async function POST(req: NextRequest) {
  const body = await req.json()
  // Ensure user exists
  let user = await db.user.findUnique({ where: { email: body.email } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: 'STUDENT',
        studentId: body.studentId || null,
        grade: body.grade ? parseInt(body.grade) : null,
        graduationYear: body.graduationYear ? parseInt(body.graduationYear) : null,
        house: body.house || null,
        phone: body.phone || null,
        pronouns: body.pronouns || null,
      }
    })
  }
  // Create membership (idempotent)
  const existing = await db.membership.findUnique({
    where: { userId_clubId: { userId: user.id, clubId: body.clubId } }
  })
  if (existing) {
    return NextResponse.json({ member: existing, already: true })
  }
  const member = await db.membership.create({
    data: {
      userId: user.id,
      clubId: body.clubId,
      role: body.role || 'MEMBER',
      customData: body.customData ? JSON.stringify(body.customData) : null,
    },
    include: { user: true }
  })
  await db.auditLog.create({
    data: { action: 'create', entity: 'Membership', entityId: member.id, clubId: body.clubId, after: JSON.stringify(member) }
  })
  return NextResponse.json({ member })
}
