import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/audit?clubId=...&entity=...&action=...&limit=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'audit')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const entity = url.searchParams.get('entity')
  const action = url.searchParams.get('action')
  const limit = parseInt(url.searchParams.get('limit') || '100')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (entity && entity !== 'ALL') where.entity = entity
  if (action && action !== 'ALL') where.action = action

  const logs = await db.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  })
  return NextResponse.json({ logs })
}
