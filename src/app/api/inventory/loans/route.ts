import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/inventory/loans?clubId=...&status=... — list all loans
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')

  const where: any = {}
  if (status) where.status = status
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

  const loans = await db.inventoryLoan.findMany({
    where,
    include: {
      item: { select: { id: true, name: true, category: true, clubId: true } },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { checkoutDate: 'desc' },
  })

  return NextResponse.json({ loans })
}

// Return an item (PATCH with loan ID + return condition)
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { loanId, conditionAtReturn, depositReturned, notes } = body
  if (!loanId) return NextResponse.json({ error: 'loanId required' }, { status: 400 })

  // Verify the caller has permission on the loan's club. Either the borrower
  // themselves OR someone with club:write on the item's club.
  const existing = await db.inventoryLoan.findUnique({
    where: { id: loanId },
    include: { item: { select: { clubId: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  const isBorrower = existing.userId === user.id
  if (!isBorrower && !hasPermission(user, 'club:write', existing.item.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const loan = await db.inventoryLoan.update({
    where: { id: loanId },
    data: {
      returnedDate: new Date(),
      conditionAtReturn: conditionAtReturn || null,
      depositReturned: depositReturned ?? null,
      notes: notes || null,
      status: conditionAtReturn === 'BROKEN' || conditionAtReturn === 'LOST' ? conditionAtReturn : 'RETURNED',
    },
  })

  await db.inventoryItem.update({
    where: { id: loan.itemId },
    data: { quantityAvailable: { increment: 1 } },
  })

  if (conditionAtReturn === 'BROKEN' || conditionAtReturn === 'LOST') {
    await db.inventoryItem.update({
      where: { id: loan.itemId },
      data: { condition: conditionAtReturn, quantity: { decrement: 1 } },
    })
  }

  return NextResponse.json(loan)
}
