import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { drainOne } from '@/lib/clubhub/dispatchers'

// GET /api/email/queue?clubId=...&status=QUEUED
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (status) where.status = status
  const items = await db.emailQueue.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { template: { select: { name: true } } },
  })
  return NextResponse.json({ queue: items })
}

// POST /api/email/queue — drain pending items (called by cron)
export async function POST(req: NextRequest) {
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
