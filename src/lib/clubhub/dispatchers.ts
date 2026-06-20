/**
 * Central dispatchers — wire up *real* side-effects from any API route.
 *
 * These replace the Phase 1/2 "dummy" toggles (sendEmail / sendSMS flags that
 * did nothing) with actual pipelines:
 *   - sendEmail / enqueueEmail — merge template + queue + transport
 *   - emitWebhook — fire HTTP POST to registered webhook URLs with HMAC signing
 *   - pushNotification — create in-app Notification row + (optionally) email it
 *   - emitEvent — single entry point that calls notification + webhook + email
 *
 * Everything is fail-safe: side-effects never throw into the caller. Errors
 * are logged to the EmailLog / SmsLog / AuditLog tables so the main mutation
 * still succeeds.
 */

import { db } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

// ============================================================
// EMAIL — Nodemailer transport (SMTP from env) with file-fallback
// ============================================================

let transporter: any = null

/** Dev-mode mailbox dir. Each sent email is saved as an HTML file here so
 *  developers without SMTP can inspect exactly what would have been sent.
 *  Lives inside the project root so it survives server restarts and is
 *  easy to find. */
const DEV_MAILBOX_DIR = path.join(process.cwd(), 'dev-emails')

async function ensureDevMailbox() {
  try {
    await fs.mkdir(DEV_MAILBOX_DIR, { recursive: true })
  } catch {
    /* ignore — likely already exists */
  }
}

/** Persist an email to the dev mailbox as an HTML file. Returns the absolute
 *  file path so callers (and the API route) can surface it to the developer. */
export async function saveDevEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<string> {
  await ensureDevMailbox()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const slug = (opts.to || 'unknown').replace(/[^a-z0-9.@_-]/gi, '_').slice(0, 60)
  const rand = crypto.randomBytes(4).toString('hex')
  const filename = `${stamp}__${slug}__${rand}.html`
  const filepath = path.join(DEV_MAILBOX_DIR, filename)

  // Wrap the original HTML in a small inspector shell that shows the
  // metadata at the top, then renders the email below in an iframe-like
  // container so the email's own styles don't leak into the page.
  const wrapper = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Dev mailbox — ${escapeHtml(opts.subject)}</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f6f6; color: #1a1a1a; }
  .meta { padding: 14px 20px; background: #fff; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
  .meta strong { display: inline-block; min-width: 70px; color: #666; font-weight: 500; }
  .frame { padding: 24px; }
  .email { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e5e5; padding: 24px; }
</style>
</head>
<body>
  <div class="meta">
    <div><strong>To:</strong> ${escapeHtml(opts.to)}</div>
    <div><strong>Subject:</strong> ${escapeHtml(opts.subject)}</div>
    <div><strong>Sent:</strong> ${new Date().toString()}</div>
    <div><strong>Mode:</strong> Dev mailbox (SMTP not configured — email was not actually delivered)</div>
  </div>
  <div class="frame">
    <div class="email">
      ${opts.html}
    </div>
  </div>
</body>
</html>`
  await fs.writeFile(filepath, wrapper, 'utf8')
  return filepath
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** True when SMTP is not configured and we're not in production. The API
 *  layer uses this to decide whether to surface dev-mode affordances
 *  (inline link, email preview) to the caller. */
export function isDevMailboxMode(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST
}

async function getTransporter() {
  if (transporter) return transporter
  // Dynamic import so the package is only loaded when actually needed
  try {
    const nodemailer = await import('nodemailer')
    const host = process.env.SMTP_HOST
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587
    if (host) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    } else {
      // No SMTP configured — use a stream transport so nodemailer's
      // sendMail() still resolves (we don't actually deliver anything),
      // and additionally persist the email HTML to /dev-emails/ so the
      // developer can inspect it. See saveDevEmail().
      transporter = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
      })
    }
  } catch (e) {
    console.error('[email] Failed to init transporter', e)
    transporter = null
  }
  return transporter
}

/** Merge {{field}} placeholders into a template string. */
export function mergeTemplate(
  template: string,
  data: Record<string, any>
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const parts = key.split('.')
    let val: any = data
    for (const p of parts) {
      val = val?.[p]
      if (val === undefined) break
    }
    return val === undefined || val === null ? '' : String(val)
  })
}

export interface EmailPayload {
  toEmail: string
  toName?: string
  subject: string
  body: string  // HTML
  clubId?: string
  templateId?: string
  mergeData?: Record<string, any>
  scheduledFor?: Date
}

/**
 * Enqueue an email — always succeeds (writes to EmailQueue).
 * A separate /api/cron/email-processor route (or background job) drains the queue.
 * For low-volume use we also attempt immediate send inline.
 */
export async function enqueueEmail(payload: EmailPayload): Promise<string> {
  const merged = payload.mergeData
    ? {
        subject: mergeTemplate(payload.subject, payload.mergeData),
        body: mergeTemplate(payload.body, payload.mergeData),
      }
    : { subject: payload.subject, body: payload.body }

  const queueItem = await db.emailQueue.create({
    data: {
      clubId: payload.clubId || null,
      templateId: payload.templateId || null,
      toEmail: payload.toEmail,
      toName: payload.toName || null,
      fromEmail: process.env.EMAIL_FROM || 'noreply@roster.local',
      subject: merged.subject,
      body: merged.body,
      mergeData: payload.mergeData ? JSON.stringify(payload.mergeData) : null,
      status: 'QUEUED',
      scheduledFor: payload.scheduledFor || new Date(),
    },
  })

  // Inline send attempt (fail-safe)
  drainOne(queueItem.id).catch((e) =>
    console.error('[email] inline send failed', e)
  )

  return queueItem.id
}

/** Drain a single queue item — used by both inline sender and cron. */
export async function drainOne(queueId: string): Promise<boolean> {
  const item = await db.emailQueue.findUnique({ where: { id: queueId } })
  if (!item || item.status === 'SENT') return false

  const transport = await getTransporter()
  if (!transport) {
    await db.emailQueue.update({
      where: { id: queueId },
      data: { status: 'FAILED', lastError: 'No transporter available', attempts: { increment: 1 } },
    })
    return false
  }

  try {
    const info = await transport.sendMail({
      from: item.fromEmail || process.env.EMAIL_FROM || 'noreply@roster.local',
      to: item.toName ? `${item.toName} <${item.toEmail}>` : item.toEmail,
      subject: item.subject,
      html: item.body,
    })

    // Dev mailbox capture — when SMTP isn't configured, also save the email
    // HTML to disk so the developer can inspect what would have been sent.
    // The status is still 'SENT' from nodemailer's perspective (the stream
    // transport "delivered" it), but we annotate lastError with the dev
    // mailbox path so it's discoverable in the EmailQueue table.
    if (isDevMailboxMode()) {
      try {
        const devPath = await saveDevEmail({
          to: item.toEmail,
          subject: item.subject,
          html: item.body,
        })
        console.log(`[email] Dev mailbox saved: ${devPath}`)
        await db.emailQueue.update({
          where: { id: queueId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastError: `DEV_MAILBOX:${devPath}`,
          },
        })
      } catch (e: any) {
        console.error('[email] Failed to save dev mailbox copy', e)
      }
    } else {
      await db.emailQueue.update({
        where: { id: queueId },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      })
    }

    await db.emailLog.create({
      data: {
        clubId: item.clubId,
        toEmail: item.toEmail,
        subject: item.subject,
        status: 'SENT',
        providerId: info?.messageId || info?.response || null,
      },
    })

    return true
  } catch (e: any) {
    await db.emailQueue.update({
      where: { id: queueId },
      data: {
        status: 'FAILED',
        lastError: e?.message || 'Unknown error',
        attempts: { increment: 1 },
      },
    })

    await db.emailLog.create({
      data: {
        clubId: item.clubId,
        toEmail: item.toEmail,
        subject: item.subject,
        status: 'FAILED',
        error: e?.message,
      },
    })

    return false
  }
}

/** Convenience: send an email immediately using a template by name. */
export async function sendTemplatedEmail(opts: {
  clubId: string
  templateType: string
  toEmail: string
  toName?: string
  mergeData: Record<string, any>
}): Promise<string | null> {
  const tpl = await db.emailTemplate.findFirst({
    where: { clubId: opts.clubId, type: opts.templateType },
  })
  if (!tpl) {
    // Fall back to global default templates
    return null
  }
  return enqueueEmail({
    toEmail: opts.toEmail,
    toName: opts.toName,
    subject: tpl.subject,
    body: tpl.body,
    clubId: opts.clubId,
    templateId: tpl.id,
    mergeData: opts.mergeData,
  })
}

// ============================================================
// WEBHOOK DISPATCHER — fire signed HTTP POST to registered URLs
// ============================================================

export type WebhookEvent =
  | 'announcement.created'
  | 'announcement.updated'
  | 'event.created'
  | 'event.updated'
  | 'event.cancelled'
  | 'attendance.checked_in'
  | 'rsvp.created'
  | 'rsvp.cancelled'
  | 'member.joined'
  | 'member.left'
  | 'task.assigned'
  | 'task.completed'
  | 'poll.created'
  | 'poll.closed'
  | 'form.submitted'
  | 'badge.awarded'
  | 'budget.warning'
  | 'application.submitted'
  | 'application.accepted'
  | 'inventory.loaned'
  | 'inventory.returned'
  | 'inventory.overdue'
  | 'insight.generated'

export async function emitWebhook(
  clubId: string,
  event: WebhookEvent,
  payload: any
): Promise<void> {
  try {
    const hooks = await db.webhook.findMany({
      where: { clubId, isActive: true },
    })

    const matching = hooks.filter((h) => {
      try {
        const events: string[] = JSON.parse(h.events || '[]')
        return events.length === 0 || events.includes(event) || events.includes('*')
      } catch {
        return true
      }
    })

    await Promise.all(
      matching.map(async (hook) => {
        const body = JSON.stringify({
          event,
          clubId,
          timestamp: new Date().toISOString(),
          data: payload,
        })

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Roster-Event': event,
          'X-Roster-Timestamp': new Date().toISOString(),
        }

        if (hook.secret) {
          // HMAC-SHA256 signature so receivers can verify authenticity
          const { createHmac } = await import('crypto')
          const sig = createHmac('sha256', hook.secret).update(body).digest('hex')
          headers['X-Roster-Signature'] = `sha256=${sig}`
        }

        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10000),
          })

          await db.webhook.update({
            where: { id: hook.id },
            data: {
              lastTriggeredAt: new Date(),
              lastResponseStatus: res.status,
            },
          })
        } catch (e: any) {
          await db.webhook.update({
            where: { id: hook.id },
            data: {
              lastTriggeredAt: new Date(),
              lastResponseStatus: 0,
            },
          })
        }
      })
    )
  } catch (e) {
    console.error('[webhook] emit failed', e)
  }
}

// ============================================================
// NOTIFICATION DISPATCHER — write to in-app Notification table
// ============================================================

export interface NotificationPayload {
  userId: string
  clubId?: string
  type: string  // matches NOTIFICATION_TYPES in types.ts
  title: string
  body: string
  link?: string
  metadata?: Record<string, any>
  sendEmail?: boolean
}

export async function pushNotification(opts: NotificationPayload): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: opts.userId,
        clubId: opts.clubId || null,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        link: opts.link || null,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    })

    if (opts.sendEmail) {
      const user = await db.user.findUnique({
        where: { id: opts.userId },
        select: { email: true, name: true },
      })
      if (user) {
        await enqueueEmail({
          toEmail: user.email,
          toName: user.name,
          subject: opts.title,
          body: `<div style="font-family:sans-serif"><p>${opts.body}</p>${
            opts.link ? `<p><a href="${opts.link}">Open in Roster →</a></p>` : ''
          }</p></div>`,
          clubId: opts.clubId,
          mergeData: { name: user.name, ...(opts.metadata || {}) },
        })
      }
    }
  } catch (e) {
    console.error('[notification] push failed', e)
  }
}

/** Notify all members of a club (e.g. on new announcement). */
export async function notifyClubMembers(
  clubId: string,
  opts: Omit<NotificationPayload, 'userId' | 'clubId'>,
  filters?: { role?: string; onlyActive?: boolean }
): Promise<number> {
  const where: any = { clubId, status: 'ACTIVE' }
  if (filters?.role) where.role = filters.role
  const members = await db.membership.findMany({
    where,
    select: { userId: true },
  })
  await Promise.all(
    members.map((m) =>
      pushNotification({ ...opts, userId: m.userId, clubId })
    )
  )
  return members.length
}

// ============================================================
// UNIFIED EVENT EMITTER — calls webhook + notification + email
// ============================================================

export async function emitClubEvent(
  clubId: string,
  event: WebhookEvent,
  data: {
    title: string
    body: string
    link?: string
    payload: any
    notifyUserIds?: string[]  // specific users to push notification
    notifyAllMembers?: boolean
    sendEmailToMembers?: boolean
  }
): Promise<void> {
  // 1. Fire webhook to all registered subscribers
  await emitWebhook(clubId, event, data.payload)

  // 2. Push in-app notifications
  if (data.notifyUserIds?.length) {
    await Promise.all(
      data.notifyUserIds.map((userId) =>
        pushNotification({
          userId,
          clubId,
          type: event.split('.')[0].toUpperCase(),
          title: data.title,
          body: data.body,
          link: data.link,
          sendEmail: data.sendEmailToMembers,
        })
      )
    )
  }

  if (data.notifyAllMembers) {
    await notifyClubMembers(clubId, {
      type: event.split('.')[0].toUpperCase(),
      title: data.title,
      body: data.body,
      link: data.link,
      sendEmail: data.sendEmailToMembers,
    })
  }
}
