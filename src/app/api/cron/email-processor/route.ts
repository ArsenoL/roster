import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { drainOne } from '@/lib/clubhub/dispatchers'
import { verifySecretFromHeader } from '@/lib/clubhub/sanitize'

/**
 * POST /api/cron/email-processor
 * Drains up to N queued emails per run. Designed to be invoked by an external
 * cron scheduler (Vercel Cron, systemd timer, Kubernetes CronJob, etc.) every
 * minute or so. Protected by a shared secret in case it's exposed publicly.
 *
 * Auth: the secret MUST be sent in the `x-cron-secret` request header (not the
 * URL — secrets in URLs leak into access logs, browser history, and referrer
 * headers).
 *
 * Query:
 *   ?batchSize=...
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const expectedSecret = process.env.CRON_SECRET
  const ok = verifySecretFromHeader(req, 'x-cron-secret', expectedSecret)

  // In production, a secret MUST be configured and provided. In dev (when no
  // secret is set), allow unauthenticated calls so local development without
  // env vars still works.
  if (process.env.NODE_ENV === 'production') {
    if (!expectedSecret) {
      console.error('[cron/email-processor] CRON_SECRET not set in production — refusing to run')
      return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET not set' }, { status: 500 })
    }
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (expectedSecret && !ok) {
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
    const delivered = await drainOne(item.id)
    if (delivered) sent++
    else failed++
  }

  // Also sweep FAILED items that haven't exceeded retry limit — actually
  // flip them back to QUEUED so the next run picks them up (previously this
  // only counted them, so they were never retried).
  const retried = await db.emailQueue.updateMany({
    where: { status: 'FAILED', attempts: { lt: 5 } },
    data: { status: 'QUEUED' },
  })

  return NextResponse.json({
    processed: due.length,
    sent,
    failed,
    queuedForRetry: retried.count,
    timestamp: new Date().toISOString(),
  })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
