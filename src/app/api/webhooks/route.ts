import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/webhooks?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  const webhooks = await db.webhook.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ webhooks })
}

// POST /api/webhooks — create a new webhook
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { randomBytes } = await import('crypto')
  const secret = randomBytes(24).toString('hex')
  const webhook = await db.webhook.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      url: body.url,
      events: JSON.stringify(body.events || []),
      secret,
      isActive: body.isActive ?? true,
    },
  })
  await db.auditLog.create({
    data: { action: 'create', entity: 'Webhook', entityId: webhook.id, clubId: body.clubId }
  })
  return NextResponse.json({ webhook, secret })
}
