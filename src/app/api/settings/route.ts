import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/settings?clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 })
  // Any active member can read club settings (so the dashboard renders), but
  // we still require at least club:read.
  if (!hasPermission(user, 'club:read', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const settings = await db.clubSetting.findUnique({ where: { clubId } })
  if (!settings) {
    // create default settings
    return NextResponse.json({ settings: await db.clubSetting.create({ data: { clubId } }) })
  }
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { clubId, ...updates } = body
  if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 })
  if (!hasPermission(user, 'club:write', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const settings = await db.clubSetting.upsert({
    where: { clubId },
    create: { clubId, ...updates },
    update: updates,
  })
  await db.auditLog.create({
    data: { action: 'update', entity: 'ClubSetting', entityId: clubId, clubId, userId: user.id, after: JSON.stringify(settings) }
  })
  return NextResponse.json({ settings })
}
