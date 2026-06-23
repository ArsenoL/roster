import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { isClubMember } from '@/lib/clubhub/sanitize'

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

  // De-duplicate userIds before both loops so a caller-supplied list with
  // repeats can't double-award points or thrash the audit log.
  const uniqueIds = [...new Set(userIds)]

  // Validate each uid is an active member of this club — otherwise a caller
  // could award badges + points to users in other clubs (cross-tenant).
  for (const uid of uniqueIds) {
    const ok = await isClubMember(uid, badge.clubId)
    if (!ok) return NextResponse.json({ error: `User ${uid} is not a member of this club` }, { status: 400 })
  }

  // Atomic award loop + points increment so a crash between them can't leave
  // a user with the badge but no points (or vice versa).
  let awarded = 0, already = 0
  await db.$transaction(async (tx) => {
    for (const userId of uniqueIds) {
      try {
        await tx.userBadge.create({
          data: { userId, badgeId, awardedBy: user.id, awardedAt: new Date() }
        })
        awarded++
      } catch (e) {
        already++
      }
    }
    // Add points to memberships
    for (const userId of uniqueIds) {
      const membership = await tx.membership.findUnique({ where: { userId_clubId: { userId, clubId: badge.clubId } } })
      if (membership) {
        await tx.membership.update({
          where: { id: membership.id },
          data: { points: { increment: badge.points } }
        })
      }
    }
    await tx.auditLog.create({
      data: { action: 'award', entity: 'Badge', entityId: badgeId, clubId: badge.clubId, userId: user.id, after: JSON.stringify({ awarded, already, userIds: uniqueIds }) }
    })
  })
  return NextResponse.json({ awarded, already })
}
