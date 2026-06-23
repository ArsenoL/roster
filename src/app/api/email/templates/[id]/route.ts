import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.emailTemplate.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'announcements:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const tpl = await db.emailTemplate.update({
    where: { id },
    data: {
      name: body.name,
      subject: body.subject,
      body: body.body,
      type: body.type,
    },
  })

  // Audit log — capture before/after so reviewers can see what changed.
  await db.auditLog.create({
    data: {
      action: 'update',
      entity: 'EmailTemplate',
      entityId: id,
      clubId: tpl.clubId,
      userId: user.id,
      before: JSON.stringify(existing),
      after: JSON.stringify(tpl),
    },
  })

  return NextResponse.json({ template: tpl })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.emailTemplate.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'announcements:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.emailTemplate.delete({ where: { id } })

  await db.auditLog.create({
    data: {
      action: 'delete',
      entity: 'EmailTemplate',
      entityId: id,
      clubId: existing.clubId,
      userId: user.id,
      before: JSON.stringify(existing),
    },
  })

  return NextResponse.json({ ok: true })
}
