import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { membershipBelongsToClub } from '@/lib/clubhub/sanitize'

// GET /api/finance?clubId=...
export async function GET(req: NextRequest) {
  // Auth first — never run verifyModule (which does a DB lookup) for an
  // unauthenticated caller, since that would let them probe clubId existence.
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'finance')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const period = url.searchParams.get('period') // month | semester | year | all

  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'finance:read', clubId) && !hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships.filter(m => hasPermission(user, 'finance:read', m.clubId) || hasPermission(user, 'club:read', m.clubId)).map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }

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
  // Auth first (see GET above for rationale).
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'finance')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  // Recording a transaction requires finance:write on the target club.
  if (!body.clubId || !hasPermission(user, 'finance:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate type against the allowed whitelist.
  const ALLOWED_TYPES = ['INCOME', 'EXPENSE', 'DUE', 'PAYMENT']
  if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
  }

  // Validate amount — must be a finite, positive number below 1e9.
  // Defends against NaN (parseFloat('abc')), negative amounts, and absurd
  // values that would overflow Float precision.
  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(body.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 1e9) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  // If a member is referenced, verify the membership is active in this club
  // (prevents cross-club IDOR via memberId).
  if (body.memberId) {
    const ok = await membershipBelongsToClub(body.memberId, body.clubId)
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tx = await db.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        clubId: body.clubId,
        type: body.type,
        category: body.category,
        amount,
        description: body.description || null,
        date: body.date ? new Date(body.date) : new Date(),
        recordedById: user.id,  // always the signed-in user
        memberId: body.memberId || null,
        eventId: body.eventId || null,
        receiptUrl: body.receiptUrl || null,
        status: body.status || 'COMPLETED',
        paymentMethod: body.paymentMethod || null,
        checkNumber: body.checkNumber || null,
      },
    })

    // Update budget spent if applicable. Scope the update with clubId so a
    // caller can't move another club's budget spent counter with a
    // cross-club budgetId (IDOR). updateMany accepts compound where filters
    // (update only accepts a unique id), so we use it and rely on count to
    // detect a miss.
    if (body.type === 'EXPENSE' && body.budgetId) {
      await tx.budget.updateMany({
        where: { id: body.budgetId, clubId: body.clubId },
        data: { spent: { increment: amount } },
      })
    }

    await tx.auditLog.create({
      data: {
        action: 'create',
        entity: 'Transaction',
        entityId: created.id,
        clubId: body.clubId,
        userId: user.id,
        after: JSON.stringify(created),
      },
    })

    return created
  })

  return NextResponse.json(tx)
}
