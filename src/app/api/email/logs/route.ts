import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/email/logs?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  const logs = await db.emailLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ logs })
}
