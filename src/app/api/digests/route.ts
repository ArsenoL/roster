import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/digests?clubId=...&userId=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'digests')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const userId = url.searchParams.get('userId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (userId) where.userId = userId
  const subs = await db.digestSubscription.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      club: { select: { name: true, primaryColor: true } },
    },
  })
  return NextResponse.json({ subscriptions: subs })
}

// POST /api/digests — subscribe to a digest
export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'digests')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const sub = await db.digestSubscription.upsert({
    where: { userId_clubId: { userId: body.userId, clubId: body.clubId } },
    create: {
      userId: body.userId,
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
