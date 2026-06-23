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

  function isAdmin(u: { role: string }): boolean {
    return u.role === 'SUPER_ADMIN' || u.role === 'SCHOOL_ADMIN'
  }

  if (!clubId) {
    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Only administrators may create tenant-wide API keys.' }, { status: 403 })
    }
  } else {
    if (!hasPermission(user, 'club:write', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const ALLOWED_SCOPES = new Set(['read', 'write', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'finance:write', 'attendance:read', 'attendance:write', 'announcements:write'])
  const requestedScopes = Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : ['read']
  for (const s of requestedScopes) {
    if (typeof s !== 'string' || !ALLOWED_SCOPES.has(s)) {
      return NextResponse.json({ error: `Invalid scope: ${String(s)}` }, { status: 400 })
    }
  }

  let expiresAt: Date | null = null
  if (body.expiresAt) {
    const d = new Date(body.expiresAt)
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid expiresAt' }, { status: 400 })
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000
    if (d.getTime() > Date.now() + ONE_YEAR) return NextResponse.json({ error: 'API key lifetime cannot exceed 1 year.' }, { status: 400 })
    expiresAt = d
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
      scopes: JSON.stringify(requestedScopes),
      createdBy: user.id,
      expiresAt,
    },
  })

  await db.auditLog.create({
    data: { action: 'create', entity: 'ApiKey', entityId: apiKey.id, clubId, userId: user.id }
  })

  return NextResponse.json({ apiKey: { ...apiKey, key: raw } })  // return plaintext once
}
