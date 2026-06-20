import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/badges/award
// Body: { badgeId, userIds: [] }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { badgeId, userIds, awardedBy } = body
  if (!badgeId || !Array.isArray(userIds)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  let awarded = 0, already = 0
  for (const userId of userIds) {
    try {
      await db.userBadge.create({
        data: { userId, badgeId, awardedBy, awardedAt: new Date() }
      })
      awarded++
    } catch (e) {
      already++
    }
  }
  // Add points to memberships
  const badge = await db.badge.findUnique({ where: { id: badgeId } })
  if (badge) {
    for (const userId of userIds) {
      const membership = await db.membership.findUnique({ where: { userId_clubId: { userId, clubId: badge.clubId } } })
      if (membership) {
        await db.membership.update({
          where: { id: membership.id },
          data: { points: { increment: badge.points } }
        })
      }
    }
  }
  await db.auditLog.create({
    data: { action: 'award', entity: 'Badge', entityId: badgeId, clubId: badge?.clubId, after: JSON.stringify({ awarded, already, userIds }) }
  })
  return NextResponse.json({ awarded, already })
}
