import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/maintenance?itemId=...&clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const itemId = url.searchParams.get('itemId')
  const clubId = url.searchParams.get('clubId')

  const where: any = {}
  if (itemId) where.itemId = itemId
  if (clubId && clubId !== 'ALL') where.item = { clubId }

  const logs = await db.maintenanceLog.findMany({
    where,
    include: {
      item: { select: { id: true, name: true, clubId: true } },
      performedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ logs })
}

// POST /api/maintenance — log a maintenance event
export async function POST(req: NextRequest) {
  const body = await req.json()
  const log = await db.maintenanceLog.create({
    data: {
      itemId: body.itemId,
      type: body.type || 'REPAIR',
      status: body.status || 'SCHEDULED',
      description: body.description,
      cost: body.cost || 0,
      vendor: body.vendor || null,
      performedById: body.performedById || null,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      completedAt: body.completedAt ? new Date(body.completedAt) : null,
      notes: body.notes || null,
    },
    include: { item: { select: { name: true } } },
  })

  // If item is being repaired, update condition to BROKEN until fixed
  if (body.type === 'REPAIR' && body.status !== 'COMPLETED') {
    await db.inventoryItem.update({
      where: { id: body.itemId },
      data: { condition: 'BROKEN' },
    })
  }
  if (body.status === 'COMPLETED') {
    await db.inventoryItem.update({
      where: { id: body.itemId },
      data: { condition: body.newCondition || 'GOOD' },
    })
  }

  await db.auditLog.create({
    data: {
      action: 'create', entity: 'MaintenanceLog', entityId: log.id,
      clubId: body.clubId, after: JSON.stringify(log),
    }
  })

  return NextResponse.json({ log })
}
