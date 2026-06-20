import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/finance?clubId=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'finance')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const period = url.searchParams.get('period') // month | semester | year | all

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId

  if (period && period !== 'all') {
    const now = new Date()
    let start = new Date()
    if (period === 'month') start.setMonth(now.getMonth() - 1)
    else if (period === 'semester') start = new Date(now.getFullYear(), now.getMonth() >= 7 ? 7 : 0, 1)
    else if (period === 'year') start.setFullYear(now.getFullYear() - 1)
    where.date = { gte: start }
  }

  const [transactions, budgets] = await Promise.all([
    db.transaction.findMany({
      where,
      include: {
        recordedBy: { select: { id: true, name: true } },
        member: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
    }),
    db.budget.findMany({ where: clubId && clubId !== 'ALL' ? { clubId } : {} }),
  ])

  // Summary
  const income = transactions.filter(t => t.type === 'INCOME' || t.type === 'DUE_PAYMENT').reduce((s, t) => s + t.amount, 0)
  const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
  const balance = income - expenses
  const pendingDues = transactions.filter(t => t.type === 'DUE_PAYMENT' && t.status === 'PENDING').reduce((s, t) => s + t.amount, 0)

  // By category
  const byCategory: Record<string, number> = {}
  transactions.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + (t.type === 'EXPENSE' ? t.amount : -t.amount)
  })

  // Monthly series
  const monthly: { month: string, income: number, expense: number }[] = []
  const monthMap = new Map<string, { income: number, expense: number }>()
  transactions.forEach(t => {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const cur = monthMap.get(key) || { income: 0, expense: 0 }
    if (t.type === 'INCOME' || t.type === 'DUE_PAYMENT') cur.income += t.amount
    else if (t.type === 'EXPENSE') cur.expense += t.amount
    monthMap.set(key, cur)
  })
  monthMap.forEach((v, k) => monthly.push({ month: k, ...v }))
  monthly.sort((a, b) => a.month.localeCompare(b.month))

  return NextResponse.json({
    transactions,
    budgets,
    summary: {
      income,
      expenses,
      balance,
      pendingDues,
      transactionCount: transactions.length,
      byCategory,
    },
    monthly,
  })
}

// POST /api/finance
export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'finance')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const tx = await db.transaction.create({
    data: {
      clubId: body.clubId,
      type: body.type,
      category: body.category,
      amount: parseFloat(body.amount),
      description: body.description || null,
      date: body.date ? new Date(body.date) : new Date(),
      recordedById: body.recordedById || null,
      memberId: body.memberId || null,
      eventId: body.eventId || null,
      receiptUrl: body.receiptUrl || null,
      status: body.status || 'COMPLETED',
      paymentMethod: body.paymentMethod || null,
      checkNumber: body.checkNumber || null,
    },
  })

  // Update budget spent if applicable
  if (body.type === 'EXPENSE' && body.budgetId) {
    await db.budget.update({
      where: { id: body.budgetId },
      data: { spent: { increment: parseFloat(body.amount) } },
    })
  }

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'Transaction',
      entityId: tx.id,
      clubId: body.clubId,
      after: JSON.stringify(tx),
    },
  })

  return NextResponse.json(tx)
}
