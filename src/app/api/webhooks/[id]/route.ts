import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

async function getWebhookOr403(id: string) {
  const user = await getCurrentUser()
  if (!user) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const webhook = await db.webhook.findUnique({ where: { id }, select: { clubId: true } })
  if (!webhook) return { err: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  if (!webhook.clubId || !hasPermission(user, 'club:write', webhook.clubId)) {
    return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, webhook }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await getWebhookOr403(id)
  if ('err' in guard) return guard.err

  const body = await req.json()
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.url !== undefined) update.url = body.url
  if (body.events !== undefined) update.events = JSON.stringify(body.events)
  if (body.isActive !== undefined) update.isActive = body.isActive
  const webhook = await db.webhook.update({ where: { id }, data: update })
  await db.auditLog.create({
    data: { action: 'update', entity: 'Webhook', entityId: id, clubId: guard.webhook.clubId, userId: guard.user.id }
  })
  return NextResponse.json({ webhook })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await getWebhookOr403(id)
  if ('err' in guard) return guard.err

  await db.webhook.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'delete', entity: 'Webhook', entityId: id, clubId: guard.webhook.clubId, userId: guard.user.id }
  })
  return NextResponse.json({ ok: true })
}
