import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const club = await db.club.findUnique({
    where: { id },
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      president: { select: { id: true, name: true } },
      settings: true,
      customFields: { orderBy: { sortOrder: 'asc' } },
      badges: true,
      _count: { select: { members: true, events: true } },
    }
  })
  if (!club) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ club })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Auth + per-club permission check. PATCH modifies the club itself, so
  // require club:write (or a tenant-wide admin role).
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasPermission(user, 'club:write', id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const before = await db.club.findUnique({ where: { id } })

  // Allow modules to be sent as a string[] from the client; serialize to JSON
  // string before storing. Other fields pass through unchanged.
  const data: any = { ...body }
  if (Array.isArray(body.modules)) {
    data.modules = JSON.stringify(body.modules)
  }

  const club = await db.club.update({
    where: { id },
    data,
  })
  await db.auditLog.create({
    data: { action: 'update', entity: 'Club', entityId: id, clubId: id, userId: user.id, before: JSON.stringify(before), after: JSON.stringify(club) }
  })
  return NextResponse.json({ club })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Auth + per-club permission check. DELETE is the most destructive action
  // in the product — only PRESIDENT / CLUB_LEADER / ADVISOR / SCHOOL_ADMIN /
  // SUPER_ADMIN can do it.
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasPermission(user, 'club:write', id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const before = await db.club.findUnique({ where: { id } })
  await db.club.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'delete', entity: 'Club', entityId: id, userId: user.id, before: JSON.stringify(before) }
  })
  return NextResponse.json({ success: true })
}
