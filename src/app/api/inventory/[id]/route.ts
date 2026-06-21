import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.inventoryItem.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  // Whitelist updatable fields — never spread body directly.
  const allowed: any = {}
  for (const k of ['name', 'description', 'category', 'sku', 'serialNumber', 'quantity', 'quantityAvailable', 'condition', 'purchaseDate', 'purchasePrice', 'currentValue', 'location', 'imageUrl', 'notes', 'isLoanable', 'loanPeriodDays', 'depositAmount']) {
    if (body[k] !== undefined) {
      if (k === 'purchaseDate' && body[k]) allowed[k] = new Date(body[k])
      else if ((k === 'purchasePrice' || k === 'currentValue' || k === 'depositAmount') && body[k] !== null) {
        allowed[k] = typeof body[k] === 'number' ? body[k] : parseFloat(body[k])
      } else if (k === 'quantity' || k === 'quantityAvailable' || k === 'loanPeriodDays') {
        allowed[k] = parseInt(body[k], 10)
      } else {
        allowed[k] = body[k]
      }
    }
  }

  const item = await db.inventoryItem.update({ where: { id }, data: allowed })
  return NextResponse.json(item)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.inventoryItem.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.inventoryItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
