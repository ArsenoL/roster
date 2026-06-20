import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail, mergeTemplate } from '@/lib/clubhub/dispatchers'

// POST /api/email/send — send an email (optionally via template) to recipients
// Body: { clubId, templateId?, to: [{email, name}], subject?, body?, mergeData? }
export async function POST(req: NextRequest) {
  const body = await req.json()

  if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
    return NextResponse.json({ error: 'Recipients required' }, { status: 400 })
  }

  let subject = body.subject
  let html = body.body

  if (body.templateId) {
    const tpl = await db.emailTemplate.findUnique({ where: { id: body.templateId } })
    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    subject = subject || tpl.subject
    html = html || tpl.body
  }

  const results: any[] = []
  for (const recip of body.to) {
    const perUserMerge = { ...(body.mergeData || {}), name: recip.name || recip.email.split('@')[0] }
    const finalSubject = mergeTemplate(subject, perUserMerge)
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
  }

  await db.auditLog.create({
    data: {
      action: 'send_email',
      entity: 'Email',
      clubId: body.clubId,
      after: JSON.stringify({ count: results.length, templateId: body.templateId, subject }),
    },
  })

  return NextResponse.json({ sent: results.length, results })
}
