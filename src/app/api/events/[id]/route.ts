import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await db.event.findUnique({
    where: { id },
    include: {
      club: true,
      attendances: {
        include: {
          user: { select: { id: true, name: true, email: true, studentId: true, grade: true, avatar: true } }
        },
        orderBy: { user: { name: 'asc' } },
      },
      _count: { select: { checkIns: true } },
    }
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Reading an event (especially with the full attendance roster) requires
  // club:read on the event's club.
  if (!hasPermission(user, 'club:read', event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ event })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.event.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'events:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const before = await db.event.findUnique({ where: { id } })

  // Whitelist updatable fields — never spread body directly (would allow
  // clubId re-assignment).
  const allowed: any = {}
  for (const k of ['title', 'description', 'type', 'location', 'capacity', 'isRequired', 'status', 'meetingLink', 'metadata', 'recurrenceRule']) {
    if (body[k] !== undefined) allowed[k] = body[k]
  }
  if (body.startTime) allowed.startTime = new Date(body.startTime)
  if (body.endTime) allowed.endTime = new Date(body.endTime)

  const event = await db.event.update({ where: { id }, data: allowed })
  await db.auditLog.create({
    data: { action: 'update', entity: 'Event', entityId: id, clubId: event.clubId, userId: user.id, before: JSON.stringify(before), after: JSON.stringify(event) }
  })
  return NextResponse.json({ event })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.event.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'events:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const before = await db.event.findUnique({ where: { id } })
  await db.event.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'delete', entity: 'Event', entityId: id, clubId: before?.clubId, userId: user.id, before: JSON.stringify(before) }
  })
  return NextResponse.json({ success: true })
}
