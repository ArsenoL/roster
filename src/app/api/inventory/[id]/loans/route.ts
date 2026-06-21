import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const item = await db.inventoryItem.findUnique({ where: { id }, select: { clubId: true } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', item.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const loans = await db.inventoryLoan.findMany({
    where: { itemId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { checkoutDate: 'desc' },
  })
  return NextResponse.json({ loans })
}

// Check out an item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const item = await db.inventoryItem.findUnique({ where: { id }, select: { clubId: true, quantityAvailable: true, isLoanable: true, condition: true, loanPeriodDays: true, depositAmount: true } })
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  // Only members of the club (club:read) can check out equipment.
  if (!hasPermission(user, 'club:read', item.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (item.quantityAvailable <= 0) return NextResponse.json({ error: 'None available' }, { status: 400 })
  if (!item.isLoanable) return NextResponse.json({ error: 'Item not loanable' }, { status: 400 })

  const body = await req.json()
  const checkoutDate = new Date()
  const dueDate = new Date(checkoutDate)
  dueDate.setDate(dueDate.getDate() + (body.loanDays || item.loanPeriodDays))

  const loan = await db.inventoryLoan.create({
    data: {
      itemId: id,
      userId: user.id,  // always the signed-in user
      checkoutDate,
      dueDate,
      conditionAtCheckout: item.condition,
      depositCollected: body.depositCollected ?? item.depositAmount,
      notes: body.notes || null,
      status: 'OUT',
    },
  })

  await db.inventoryItem.update({
    where: { id },
    data: { quantityAvailable: { decrement: 1 } },
  })

  return NextResponse.json(loan)
}
