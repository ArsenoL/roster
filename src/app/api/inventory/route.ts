import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'inventory')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId

  const items = await db.inventoryItem.findMany({
    where,
    include: {
      loans: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { checkoutDate: 'desc' },
        take: 5,
      },
      _count: { select: { loans: true } },
    },
    orderBy: { name: 'asc' },
  })

  const summary = {
    totalItems: items.reduce((s, i) => s + i.quantity, 0),
    totalValue: items.reduce((s, i) => s + (i.currentValue || i.purchasePrice || 0) * i.quantity, 0),
    available: items.reduce((s, i) => s + i.quantityAvailable, 0),
    outOnLoan: items.reduce((s, i) => s + (i.quantity - i.quantityAvailable), 0),
    byCondition: items.reduce((acc, i) => {
      acc[i.condition] = (acc[i.condition] || 0) + i.quantity
      return acc
    }, {} as Record<string, number>),
  }

  return NextResponse.json({ items, summary })
}

export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'inventory')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const item = await db.inventoryItem.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      description: body.description || null,
      category: body.category || 'other',
      sku: body.sku || null,
      serialNumber: body.serialNumber || null,
      quantity: body.quantity || 1,
      quantityAvailable: body.quantity || 1,
      condition: body.condition || 'NEW',
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      purchasePrice: body.purchasePrice ? parseFloat(body.purchasePrice) : null,
      currentValue: body.currentValue ? parseFloat(body.currentValue) : null,
      location: body.location || null,
      imageUrl: body.imageUrl || null,
      notes: body.notes || null,
      isLoanable: body.isLoanable ?? true,
      loanPeriodDays: body.loanPeriodDays || 7,
      depositAmount: body.depositAmount ? parseFloat(body.depositAmount) : 0,
    },
  })

  return NextResponse.json(item)
}
