import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/audit?clubId=...&entity=...&action=...&limit=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'audit')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const entity = url.searchParams.get('entity')
  const action = url.searchParams.get('action')
  const limit = parseInt(url.searchParams.get('limit') || '100')

  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    // Audit logs require audit:read (or club:read as fallback) on the club.
    if (!hasPermission(user, 'audit:read', clubId) && !hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    // Scope to clubs the user can audit (or read as a fallback).
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'audit:read', m.clubId) || hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  if (entity && entity !== 'ALL') where.entity = entity
  if (action && action !== 'ALL') where.action = action

  const logs = await db.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  })
  return NextResponse.json({ logs })
}
