import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/reports?type=attendance|service-letter|member-directory|finance|roster&clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'summary'
  const clubId = url.searchParams.get('clubId')
  const userId = url.searchParams.get('userId')

  if (!clubId || clubId === 'ALL') {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 })
  }

  const club = await db.club.findUnique({
    where: { id: clubId },
    include: {
      advisor: { select: { name: true, email: true } },
      president: { select: { name: true } },
    },
  })
  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  if (type === 'service-letter' && userId) {
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const hours = await db.volunteerHours.findMany({
      where: { userId, clubId, status: 'APPROVED' },
      include: { event: { select: { title: true, startTime: true } } },
      orderBy: { date: 'asc' },
    })
    const total = hours.reduce((s, h) => s + h.hours, 0)
    const memberSince = await db.membership.findUnique({
      where: { userId_clubId: { userId, clubId } },
      select: { joinedAt: true, role: true },
    })

    return NextResponse.json({
      type,
      club,
      user,
      hours,
      totalHours: total,
      memberSince: memberSince?.joinedAt,
      role: memberSince?.role,
      generatedAt: new Date().toISOString(),
    })
  }

  if (type === 'attendance') {
    const events = await db.event.findMany({
      where: { clubId },
      include: {
        attendances: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
      orderBy: { startTime: 'asc' },
    })
    return NextResponse.json({ type, club, events, generatedAt: new Date().toISOString() })
  }

  if (type === 'roster') {
    const members = await db.membership.findMany({
      where: { clubId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, studentId: true, grade: true, graduationYear: true, phone: true } },
      },
      orderBy: { role: 'asc' },
    })
    return NextResponse.json({ type, club, members, generatedAt: new Date().toISOString() })
  }

  if (type === 'finance') {
    const transactions = await db.transaction.findMany({
      where: { clubId },
      include: { recordedBy: { select: { name: true } } },
      orderBy: { date: 'asc' },
    })
    const income = transactions.filter(t => t.type === 'INCOME' || t.type === 'DUE_PAYMENT').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
    return NextResponse.json({
      type, club, transactions,
      summary: { income, expenses, balance: income - expenses },
      generatedAt: new Date().toISOString(),
    })
  }

  if (type === 'member-summary' && userId) {
    const user = await db.user.findUnique({ where: { id: userId } })
    const membership = await db.membership.findUnique({
      where: { userId_clubId: { userId, clubId } },
    })
    const attendances = await db.attendance.findMany({
      where: { userId, event: { clubId } },
      include: { event: { select: { id: true, title: true, startTime: true, type: true } } },
      orderBy: { event: { startTime: 'asc' } },
    })
    const badges = await db.userBadge.findMany({
      where: { userId, badge: { clubId } },
      include: { badge: true },
    })
    const hours = await db.volunteerHours.findMany({
      where: { userId, clubId, status: 'APPROVED' },
    })
    return NextResponse.json({
      type, club, user, membership, attendances, badges, hours,
      generatedAt: new Date().toISOString(),
    })
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}
