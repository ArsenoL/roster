import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/badges?clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'gamification')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  const badges = await db.badge.findMany({
    where,
    include: {
      _count: { select: { userBadges: true } },
    },
    orderBy: { createdAt: 'asc' }
  })
  return NextResponse.json({ badges })
}

// POST /api/badges — create a new badge
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'gamification')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const badge = await db.badge.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      description: body.description || null,
      icon: body.icon || '🏆',
      color: body.color || '#f59e0b',
      tier: body.tier || 'BRONZE',
      points: body.points || 0,
      criteria: body.criteria ? JSON.stringify(body.criteria) : null,
    }
  })
  await db.auditLog.create({
    data: { action: 'create', entity: 'Badge', entityId: badge.id, clubId: body.clubId, userId: user.id, after: JSON.stringify(badge) }
  })
  return NextResponse.json({ badge })
}
