import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = await db.resource.findUnique({
    where: { id },
    include: {
      bookings: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { startTime: 'desc' },
      },
    },
  })
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', resource.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ resource })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.resource.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  // Whitelist updatable fields — never spread body directly (would allow
  // clubId re-assignment).
  const allowed: any = {}
  for (const k of ['name', 'type', 'description', 'location', 'capacity', 'imageUrl', 'isBookable', 'bookingWindowDays', 'maxBookingHours', 'requiresApproval', 'contactUserId', 'tags']) {
    if (body[k] !== undefined) {
      allowed[k] = k === 'tags' && typeof body[k] !== 'string' ? JSON.stringify(body[k]) : body[k]
    }
  }

  const r = await db.resource.update({ where: { id }, data: allowed })
  return NextResponse.json(r)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.resource.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.resource.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
