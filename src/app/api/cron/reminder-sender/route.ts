import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySecretFromHeader, escapeHtml, stripNewlines } from '@/lib/clubhub/sanitize'

/**
 * POST /api/cron/reminder-sender
 * Sweeps AttendanceReminder rows where scheduledFor <= now and sentAt is null,
 * sends the reminder (via enqueueEmail for EMAIL channel), and marks sentAt.
 * Designed to run every 5–10 minutes from an external scheduler.
 *
 * Auth: secret MUST be sent in the `x-cron-secret` request header.
 *
 * Query: ?batchSize=...
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
      console.error('[cron/reminder-sender] CRON_SECRET not set in production — refusing to run')
      return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET not set' }, { status: 500 })
    }
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (expectedSecret && !ok) {
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
      const when =
        r.reminderType === 'PRE_EVENT'
          ? 'reminder: upcoming event'
          : r.reminderType === 'DAY_OF'
          ? "reminder: today's event"
          : 'follow-up: missed event'

      // Branch on channel: only EMAIL (and the legacy default) actually
      // enqueues an email. SMS / PUSH are logged for now — the dispatcher
      // wiring for those channels isn't in place yet, and pretending to send
      // would silently drop the reminder.
      const channel = (r.channel || 'EMAIL').toUpperCase()
      if (channel !== 'EMAIL') {
        console.log(`[reminder-sender] skipping ${channel} reminder ${r.id} for user ${r.userId}`)
        await db.attendanceReminder.update({
          where: { id: r.id },
          data: { sentAt: new Date() },
        })
        sent++
        continue
      }

      // Escape all user/event-controlled fields before interpolating into
      // HTML — names and titles are user input and could contain markup.
      const userName = escapeHtml(r.user.name)
      const eventTitle = escapeHtml(r.event.title)
      const eventLocation = escapeHtml(r.event.location || 'TBD')

      const body =
        r.reminderType === 'POST_EVENT_ABSENCE'
          ? `<p>Hi ${userName},</p><p>We noticed you missed <strong>${eventTitle}</strong> on ${new Date(r.event.startTime).toLocaleString()}.</p><p>If you have a valid reason, please submit an absence excuse.</p>`
          : `<p>Hi ${userName},</p><p>This is a ${when} for <strong>${eventTitle}</strong>.</p><p>When: ${new Date(r.event.startTime).toLocaleString()}<br/>Where: ${eventLocation}</p>`

      // Strip CR/LF from the subject to prevent header injection via the
      // email subject line.
      const subject = stripNewlines(`${when}: ${r.event.title}`)

      const dynamicImport = await import('@/lib/clubhub/dispatchers')
      await dynamicImport.enqueueEmail({
        toEmail: r.user.email,
        toName: r.user.name,
        subject,
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

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
