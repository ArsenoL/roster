import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/badges?clubId=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'gamification')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId) where.clubId = clubId
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
  const __gate = await verifyModule(req, 'gamification')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
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
    data: { action: 'create', entity: 'Badge', entityId: badge.id, clubId: body.clubId, after: JSON.stringify(badge) }
  })
  return NextResponse.json({ badge })
}
