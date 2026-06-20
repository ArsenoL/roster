import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/settings?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 })
  const settings = await db.clubSetting.findUnique({ where: { clubId } })
  if (!settings) {
    // create default settings
    return NextResponse.json({ settings: await db.clubSetting.create({ data: { clubId } }) })
  }
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { clubId, ...updates } = body
  if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 })
  const settings = await db.clubSetting.upsert({
    where: { clubId },
    create: { clubId, ...updates },
    update: updates,
  })
  await db.auditLog.create({
    data: { action: 'update', entity: 'ClubSetting', entityId: clubId, clubId, after: JSON.stringify(settings) }
  })
  return NextResponse.json({ settings })
}
