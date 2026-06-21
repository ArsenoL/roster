import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/digests?clubId=...
// Always scoped to the signed-in user — userId is NOT accepted (IDOR guard).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'digests')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')

  const where: any = { userId: user.id }
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  }

  const subs = await db.digestSubscription.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      club: { select: { name: true, primaryColor: true } },
    },
  })
  return NextResponse.json({ subscriptions: subs })
}

// POST /api/digests — subscribe to a digest (self only)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'digests')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:read', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sub = await db.digestSubscription.upsert({
    // Compound unique is [userId, clubId] — see Prisma schema.
    where: { userId_clubId: { userId: user.id, clubId: body.clubId } },
    create: {
      userId: user.id,  // always the signed-in user
      clubId: body.clubId,
      frequency: body.frequency || 'WEEKLY',
      dayOfWeek: body.dayOfWeek ?? 1,  // Monday
      hourOfDay: body.hourOfDay ?? 8,
      isActive: body.isActive ?? true,
    },
    update: {
      frequency: body.frequency,
      dayOfWeek: body.dayOfWeek,
      hourOfDay: body.hourOfDay,
      isActive: body.isActive,
    },
  })
  return NextResponse.json({ subscription: sub })
}
