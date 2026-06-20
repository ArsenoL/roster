import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/cron/reminder-sender
 * Sweeps AttendanceReminder rows where scheduledFor <= now and sentAt is null,
 * sends the email (via enqueueEmail), and marks sentAt. Designed to run every
 * 5–10 minutes from an external scheduler.
 *
 * Query / body: { secret?: string, batchSize?: number }
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const expectedSecret = process.env.CRON_SECRET
  const providedSecret =
    url.searchParams.get('secret') ||
    (await req.json().catch(() => ({}))).secret
  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batchSize = Math.min(
    parseInt(url.searchParams.get('batchSize') || '50', 10),
    200
  )

  const due = await db.attendanceReminder.findMany({
    where: { sentAt: null, scheduledFor: { lte: new Date() } },
    include: {
      event: { select: { id: true, title: true, startTime: true, location: true, clubId: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    take: batchSize,
  })

  let sent = 0
  for (const r of due) {
    try {
      const dynamicImport = await import('@/lib/clubhub/dispatchers')
      const when =
        r.reminderType === 'PRE_EVENT'
          ? 'reminder: upcoming event'
          : r.reminderType === 'DAY_OF'
          ? "reminder: today's event"
          : 'follow-up: missed event'
      const body =
        r.reminderType === 'POST_EVENT_ABSENCE'
          ? `<p>Hi ${r.user.name},</p><p>We noticed you missed <strong>${r.event.title}</strong> on ${new Date(r.event.startTime).toLocaleString()}.</p><p>If you have a valid reason, please submit an absence excuse.</p>`
          : `<p>Hi ${r.user.name},</p><p>This is a ${when} for <strong>${r.event.title}</strong>.</p><p>When: ${new Date(r.event.startTime).toLocaleString()}<br/>Where: ${r.event.location || 'TBD'}</p>`

      await dynamicImport.enqueueEmail({
        toEmail: r.user.email,
        toName: r.user.name,
        subject: `${when}: ${r.event.title}`,
        body,
        clubId: r.event.clubId,
        mergeData: {
          name: r.user.name,
          event_title: r.event.title,
          event_time: new Date(r.event.startTime).toLocaleString(),
          event_location: r.event.location || 'TBD',
        },
      })
      await db.attendanceReminder.update({
        where: { id: r.id },
        data: { sentAt: new Date() },
      })
      sent++
    } catch (e) {
      console.error('[reminder-sender] failed for', r.id, e)
    }
  }

  return NextResponse.json({
    processed: due.length,
    sent,
    timestamp: new Date().toISOString(),
  })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
