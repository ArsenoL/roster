import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { drainOne } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/email/queue?clubId=...&status=QUEUED
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    // Email queue contains recipient email addresses (PII) + rendered body
    // content (potentially sensitive). Officer+ only.
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
  if (status) where.status = status
  const items = await db.emailQueue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { template: { select: { name: true } } },
  })
  return NextResponse.json({ queue: items })
}

// POST /api/email/queue — drain pending items.
// This is normally invoked by the /api/cron/email-processor route with
// CRON_SECRET. If a signed-in user calls it directly, they must be a global
// admin (school admin / super admin) — draining the queue sends queued emails
// immediately, which shouldn't be a per-club privilege.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pending = await db.emailQueue.findMany({
    where: {
      status: 'QUEUED',
      scheduledFor: { lte: new Date() },
    },
    take: 25,
    orderBy: { scheduledFor: 'asc' },
  })

  let sent = 0
  let failed = 0
  for (const item of pending) {
    const ok = await drainOne(item.id)
    if (ok) sent++
    else failed++
  }

  return NextResponse.json({ processed: pending.length, sent, failed })
}
