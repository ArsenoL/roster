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

  // Validate loanDays — positive integer ≤ 90 (default 7).
  let loanDays: number
  if (body.loanDays === undefined || body.loanDays === null) {
    loanDays = item.loanPeriodDays || 7
  } else {
    const n = Number(body.loanDays)
    if (!Number.isInteger(n) || n <= 0 || n > 90) {
      return NextResponse.json({ error: 'loanDays must be a positive integer ≤ 90' }, { status: 400 })
    }
    loanDays = n
  }

  const checkoutDate = new Date()
  const dueDate = new Date(checkoutDate)
  dueDate.setDate(dueDate.getDate() + loanDays)

  // Atomic checkout: the availability check + loan create + item decrement
  // must all happen in one transaction so two concurrent checkouts can't
  // both pass the `quantityAvailable > 0` gate and oversell the last item.
  // The conditional updateMany (`quantityAvailable: { gte: 1 }`) is the
  // actual race arbiter — if it returns count 0, someone else got there first.
  const result = await db.$transaction(async (tx) => {
    const decremented = await tx.inventoryItem.updateMany({
      where: { id, quantityAvailable: { gte: 1 } },
      data: { quantityAvailable: { decrement: 1 } },
    })
    if (decremented.count === 0) {
      return { kind: 'oos' as const }
    }

    const loan = await tx.inventoryLoan.create({
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
    return { kind: 'ok' as const, loan }
  })

  if (result.kind === 'oos') {
    return NextResponse.json({ error: 'out of stock' }, { status: 409 })
  }

  return NextResponse.json(result.loan)
}
