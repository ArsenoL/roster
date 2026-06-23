import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail, mergeTemplate } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { stripNewlines } from '@/lib/clubhub/sanitize'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RECIPIENTS = 500

// POST /api/email/send — send an email (optionally via template) to recipients
// Body: { clubId, templateId?, to: [{email, name}], subject?, body?, mergeData? }
//
// Sending email on behalf of a club is a privileged action — require
// announcements:write on the target club.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'announcements:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
    return NextResponse.json({ error: 'Recipients required' }, { status: 400 })
  }

  // Cap the recipient list — protects against runaway loops / accidental
  // mass-mail merges that would otherwise queue thousands of rows.
  if (body.to.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { error: `Too many recipients (max ${MAX_RECIPIENTS})` },
      { status: 400 }
    )
  }

  // Validate each recipient's email up-front so we don't enqueue half a
  // batch before discovering a malformed address.
  for (const recip of body.to) {
    if (!recip || typeof recip.email !== 'string' || !EMAIL_RE.test(recip.email)) {
      return NextResponse.json(
        { error: `Invalid recipient email: ${recip?.email ?? '(missing)'}` },
        { status: 400 }
      )
    }
  }

  let subject = body.subject
  let html = body.body

  if (body.templateId) {
    const tpl = await db.emailTemplate.findUnique({ where: { id: body.templateId } })
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    // Defensive: template must belong to the same club (cross-club leakage
    // would let a user of club A send with club B's templates).
    if (tpl.clubId !== body.clubId) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    subject = subject || tpl.subject
    html = html || tpl.body
  }

  // Strip CR/LF from the subject to prevent email header injection. This
  // covers both the user-supplied `body.subject` and the template fallback
  // (`tpl.subject`) since `subject` was resolved from one of them above.
  subject = stripNewlines(subject)

  const results: any[] = []
  const errors: any[] = []
  for (const recip of body.to) {
    try {
      const perUserMerge = { ...(body.mergeData || {}), name: recip.name || recip.email.split('@')[0] }
      const finalSubject = stripNewlines(mergeTemplate(subject, perUserMerge))
      const finalBody = mergeTemplate(html, perUserMerge)
      const queueId = await enqueueEmail({
        toEmail: recip.email,
        toName: recip.name,
        subject: finalSubject,
        body: finalBody,
        clubId: body.clubId,
        templateId: body.templateId,
        mergeData: perUserMerge,
      })
      results.push({ email: recip.email, queueId })
    } catch (e: any) {
      // Record the failure but keep going — a single bad recipient shouldn't
      // 500 the whole batch (and the audit log below still records the
      // attempted send).
      errors.push({ email: recip.email, error: e?.message || String(e) })
    }
  }

  await db.auditLog.create({
    data: {
      action: 'send_email',
      entity: 'Email',
      clubId: body.clubId,
      userId: user.id,
      after: JSON.stringify({ count: results.length, errors: errors.length, templateId: body.templateId, subject }),
    },
  })

  return NextResponse.json({ sent: results.length, results, errors })
}
