import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/loans?clubId=...&status=... — list all loans
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')

  const where: any = {}
  if (status) where.status = status
  if (clubId && clubId !== 'ALL') where.item = { clubId }

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
  const body = await req.json()
  const { loanId, conditionAtReturn, depositReturned, notes } = body

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
