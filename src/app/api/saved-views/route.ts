import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/clubhub/auth'

// GET /api/saved-views?tab=...
// Always scoped to the signed-in user — userId is NOT accepted (IDOR guard).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tab = url.searchParams.get('tab')
  const where: any = { userId: user.id }
  if (tab) where.tab = tab
  const views = await db.savedView.findMany({ where, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ views })
}

// POST /api/saved-views — save a new view preset (self only)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Wrap "clear other defaults" + "create new default" in a transaction so
  // two concurrent POSTs with isDefault=true can't both end up as the
  // default for the same tab — the updateMany + create must be atomic.
  if (body.isDefault) {
    const view = await db.$transaction(async (tx) => {
      await tx.savedView.updateMany({
        where: { userId: user.id, tab: body.tab },
        data: { isDefault: false },
      })
      return tx.savedView.create({
        data: {
          userId: user.id,  // always the signed-in user
          clubId: body.clubId || null,
          tab: body.tab,
          name: body.name,
          filters: JSON.stringify(body.filters || {}),
          isDefault: body.isDefault || false,
        }
      })
    })
    return NextResponse.json({ view })
  }
  const view = await db.savedView.create({
    data: {
      userId: user.id,  // always the signed-in user
      clubId: body.clubId || null,
      tab: body.tab,
      name: body.name,
      filters: JSON.stringify(body.filters || {}),
      isDefault: body.isDefault || false,
    }
  })
  return NextResponse.json({ view })
}
