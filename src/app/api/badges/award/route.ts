import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// POST /api/badges/award
// Body: { badgeId, userIds: [] }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { badgeId, userIds } = body
  if (!badgeId || !Array.isArray(userIds)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Look up the badge to find its club, then require club:write on that club.
  // Awarding a badge also awards points — that's a money-equivalent action.
  const badge = await db.badge.findUnique({ where: { id: badgeId } })
  if (!badge) return NextResponse.json({ error: 'Badge not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', badge.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let awarded = 0, already = 0
  for (const userId of userIds) {
    try {
      await db.userBadge.create({
        data: { userId, badgeId, awardedBy: user.id, awardedAt: new Date() }
      })
      awarded++
    } catch (e) {
      already++
    }
  }
  // Add points to memberships
  for (const userId of userIds) {
    const membership = await db.membership.findUnique({ where: { userId_clubId: { userId, clubId: badge.clubId } } })
    if (membership) {
      await db.membership.update({
        where: { id: membership.id },
        data: { points: { increment: badge.points } }
      })
    }
  }
  await db.auditLog.create({
    data: { action: 'award', entity: 'Badge', entityId: badgeId, clubId: badge.clubId, userId: user.id, after: JSON.stringify({ awarded, already, userIds }) }
  })
  return NextResponse.json({ awarded, already })
}
