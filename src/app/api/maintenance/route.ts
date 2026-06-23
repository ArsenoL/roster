import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/maintenance?itemId=...&clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'maintenance')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const itemId = url.searchParams.get('itemId')
  const clubId = url.searchParams.get('clubId')

  const where: any = {}
  if (itemId) where.itemId = itemId
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.item = { clubId }
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.item = { clubId: { in: myClubIds.length > 0 ? myClubIds : ['__none__'] } }
  }

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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'maintenance')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  // Resolve the item's clubId and verify write access.
  const item = await db.inventoryItem.findUnique({ where: { id: body.itemId }, select: { clubId: true } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', item.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Wrap log create + condition update + newCondition update in a transaction
  // so a crash between them can't leave the inventory item in an inconsistent
  // state (e.g. logged as REPAIR but condition still GOOD).
  const log = await db.$transaction(async (tx) => {
    const created = await tx.maintenanceLog.create({
      data: {
        itemId: body.itemId,
        type: body.type || 'REPAIR',
        status: body.status || 'SCHEDULED',
        description: body.description,
        cost: body.cost || 0,
        vendor: body.vendor || null,
        performedById: user.id,  // always the signed-in user
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        notes: body.notes || null,
      },
      include: { item: { select: { name: true } } },
    })

    // If item is being repaired, update condition to BROKEN until fixed
    if (body.type === 'REPAIR' && body.status !== 'COMPLETED') {
      await tx.inventoryItem.update({
        where: { id: body.itemId },
        data: { condition: 'BROKEN' },
      })
    }
    if (body.status === 'COMPLETED') {
      await tx.inventoryItem.update({
        where: { id: body.itemId },
        data: { condition: body.newCondition || 'GOOD' },
      })
    }

    await tx.auditLog.create({
      data: {
        action: 'create', entity: 'MaintenanceLog', entityId: created.id,
        clubId: item.clubId, userId: user.id, after: JSON.stringify(created),
      }
    })

    return created
  })

  return NextResponse.json({ log })
}
