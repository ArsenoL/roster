import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/saved-views?userId=...&tab=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const tab = url.searchParams.get('tab')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  const where: any = { userId }
  if (tab) where.tab = tab
  const views = await db.savedView.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ views })
}

// POST /api/saved-views — save a new view preset
export async function POST(req: NextRequest) {
  const body = await req.json()
  // If isDefault, unset other defaults for this user+tab
  if (body.isDefault) {
    await db.savedView.updateMany({
      where: { userId: body.userId, tab: body.tab },
      data: { isDefault: false },
    })
  }
  const view = await db.savedView.create({
    data: {
      userId: body.userId,
      clubId: body.clubId || null,
      tab: body.tab,
      name: body.name,
      filters: JSON.stringify(body.filters || {}),
      isDefault: body.isDefault || false,
    }
  })
  return NextResponse.json({ view })
}
