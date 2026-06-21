import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/email/logs?clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    // Email logs contain recipient email addresses and subject lines (PII).
    // Require announcements:write (officer+) to view.
    if (!hasPermission(user, 'announcements:write', clubId) && !hasPermission(user, 'club:write', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'announcements:write', m.clubId) || hasPermission(user, 'club:write', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  const logs = await db.emailLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ logs })
}
