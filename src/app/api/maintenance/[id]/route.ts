import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.maintenanceLog.findUnique({
    where: { id },
    include: { item: { select: { clubId: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.item.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const update: any = {}
  if (body.status !== undefined) update.status = body.status
  if (body.description !== undefined) update.description = body.description
  if (body.cost !== undefined) update.cost = body.cost
  if (body.vendor !== undefined) update.vendor = body.vendor
  if (body.scheduledFor !== undefined) update.scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : null
  if (body.completedAt !== undefined) update.completedAt = body.completedAt ? new Date(body.completedAt) : null
  if (body.notes !== undefined) update.notes = body.notes

  const log = await db.maintenanceLog.update({ where: { id }, data: update })

  // Sync item condition based on completion status
  if (body.status === 'COMPLETED' && body.itemId) {
    await db.inventoryItem.update({
      where: { id: body.itemId },
      data: { condition: body.newCondition || 'GOOD' },
    })
  }

  return NextResponse.json({ log })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.maintenanceLog.findUnique({
    where: { id },
    include: { item: { select: { clubId: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.item.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.maintenanceLog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
