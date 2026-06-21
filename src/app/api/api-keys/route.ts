import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/api-keys?clubId=...
// Auth required — API key prefixes are sensitive (the prefix alone can identify
// the club and confirm a key exists). Only return keys for clubs the caller
// has club:write on.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId

  // If a specific clubId is requested, the caller must have club:write on it.
  // For "ALL" / no filter, super-admins/school-admins see everything; everyone
  // else only sees keys for clubs they can manage.
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:write', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    where.clubId = { in: user.memberships.filter(m => hasPermission(user, 'club:write', m.clubId)).map(m => m.clubId) }
  }

  const keys = await db.apiKey.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true, clubId: true },
  })
  return NextResponse.json({ apiKeys: keys })
}

// POST /api/api-keys — generate a new API key (returns plaintext key ONCE)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const clubId = body.clubId || null

  // Minting an API key grants API access to a club — require club:write.
  if (clubId && !hasPermission(user, 'club:write', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { randomBytes, createHash } = await import('crypto')
  const raw = `chk_${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 12)

  const apiKey = await db.apiKey.create({
    data: {
      clubId,
      name: body.name,
      keyHash,
      prefix,
      scopes: JSON.stringify(body.scopes || ['read']),
      createdBy: user.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  })

  await db.auditLog.create({
    data: { action: 'create', entity: 'ApiKey', entityId: apiKey.id, clubId, userId: user.id }
  })

  return NextResponse.json({ apiKey: { ...apiKey, key: raw } })  // return plaintext once
}
