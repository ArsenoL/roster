import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/webhooks?clubId=...
// Webhook secrets are sensitive — they're the shared secret used to sign
// outbound payloads. Only return webhooks for clubs the caller can manage.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:write', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    where.clubId = { in: user.memberships.filter(m => hasPermission(user, 'club:write', m.clubId)).map(m => m.clubId) }
  }
  const webhooks = await db.webhook.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ webhooks })
}

// POST /api/webhooks — create a new webhook
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const clubId = body.clubId
  if (!clubId || !hasPermission(user, 'club:write', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { randomBytes } = await import('crypto')
  const secret = randomBytes(24).toString('hex')
  const webhook = await db.webhook.create({
    data: {
      clubId,
      name: body.name,
      url: body.url,
      events: JSON.stringify(body.events || []),
      secret,
      isActive: body.isActive ?? true,
    },
  })
  await db.auditLog.create({
    data: { action: 'create', entity: 'Webhook', entityId: webhook.id, clubId, userId: user.id }
  })
  return NextResponse.json({ webhook, secret })
}
