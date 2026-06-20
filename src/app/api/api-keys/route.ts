import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/api-keys?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  const keys = await db.apiKey.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true, clubId: true },
  })
  return NextResponse.json({ apiKeys: keys })
}

// POST /api/api-keys — generate a new API key (returns plaintext key ONCE)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { randomBytes, createHash } = await import('crypto')
  const raw = `chk_${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 12)

  const apiKey = await db.apiKey.create({
    data: {
      clubId: body.clubId || null,
      name: body.name,
      keyHash,
      prefix,
      scopes: JSON.stringify(body.scopes || ['read']),
      createdBy: body.createdBy || null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  })

  await db.auditLog.create({
    data: { action: 'create', entity: 'ApiKey', entityId: apiKey.id, clubId: body.clubId }
  })

  return NextResponse.json({ apiKey: { ...apiKey, key: raw } })  // return plaintext once
}
