import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { drainOne } from '@/lib/clubhub/dispatchers'

/**
 * POST /api/cron/email-processor
 * Drains up to N queued emails per run. Designed to be invoked by an external
 * cron scheduler (Vercel Cron, systemd timer, Kubernetes CronJob, etc.) every
 * minute or so. Protected by a shared secret in case it's exposed publicly.
 *
 * Body (optional):
 *   { secret?: string, batchSize?: number }
 *
 * Query:
 *   ?secret=...&batchSize=...
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const expectedSecret = process.env.CRON_SECRET
  const providedSecret =
    url.searchParams.get('secret') ||
    (await req.json().catch(() => ({}))).secret

  // If a secret is configured, require it. If not configured, allow (dev mode).
  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batchSize = Math.min(
    parseInt(url.searchParams.get('batchSize') || '20', 10),
    100
  )

  // Pick up emails that are QUEUED and due now (scheduledFor <= now)
  const due = await db.emailQueue.findMany({
    where: {
      status: 'QUEUED',
      scheduledFor: { lte: new Date() },
      attempts: { lt: 5 },
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
    select: { id: true },
  })

  let sent = 0
  let failed = 0
  for (const item of due) {
    const ok = await drainOne(item.id)
    if (ok) sent++
    else failed++
  }

  // Also sweep FAILED items that haven't exceeded retry limit
  const retried = await db.emailQueue.count({
    where: { status: 'FAILED', attempts: { lt: 5 } },
  })

  return NextResponse.json({
    processed: due.length,
    sent,
    failed,
    queuedForRetry: retried,
    timestamp: new Date().toISOString(),
  })
}

export async function GET(req: NextRequest) {
  // Same handler so cron services that send GET also work.
  return POST(req)
}
