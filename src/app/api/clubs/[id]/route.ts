import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

const PATCHABLE_FIELDS = ['name', 'description', 'primaryColor', 'accentColor', 'logo', 'coverImage', 'defaultDay', 'defaultTime', 'meetingRoom', 'dues', 'isPublic', 'category', 'tags', 'mission', 'foundedYear'] as const
const SENSITIVE_FIELDS = ['presidentId', 'advisorId', 'slug', 'status'] as const

function isAdmin(user: { role: string }): boolean {
  return user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN'
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const club = await db.club.findUnique({
    where: { id },
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      president: { select: { id: true, name: true } },
      settings: true,
      customFields: { orderBy: { sortOrder: 'asc' } },
      badges: true,
      _count: { select: { members: true, events: true } },
    },
  })
  if (!club) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canRead = hasPermission(user, 'club:read', id)
  if (!canRead && !club.isPublic) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!canRead) {
    return NextResponse.json({
      club: {
        id: club.id, name: club.name, description: club.description,
        primaryColor: club.primaryColor, accentColor: club.accentColor,
        logo: club.logo, coverImage: club.coverImage,
        defaultDay: club.defaultDay, defaultTime: club.defaultTime, meetingRoom: club.meetingRoom,
        category: club.category, isPublic: club.isPublic,
        president: club.president, _count: club._count,
      },
    })
  }

  return NextResponse.json({ club })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user, 'club:write', id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const before = await db.club.findUnique({ where: { id } })

  const data: any = {}
  for (const k of PATCHABLE_FIELDS) {
    if (k in body) data[k] = body[k]
  }
  if (Array.isArray(body.modules)) data.modules = JSON.stringify(body.modules)

  if (isAdmin(user)) {
    for (const k of SENSITIVE_FIELDS) {
      if (k in body) data[k] = body[k]
    }
  } else if (SENSITIVE_FIELDS.some(k => k in body)) {
    return NextResponse.json({ error: 'Only administrators may change presidentId / advisorId / slug / status.' }, { status: 403 })
  }

  const club = await db.club.update({ where: { id }, data })

  const changes: Record<string, { before: any; after: any }> = {}
  for (const k of Object.keys(data)) {
    if (JSON.stringify(before?.[k as keyof typeof before]) !== JSON.stringify(club[k as keyof typeof club])) {
      changes[k] = { before: before?.[k as keyof typeof before], after: club[k as keyof typeof club] }
    }
  }
  await db.auditLog.create({
    data: { action: 'update', entity: 'Club', entityId: id, clubId: id, userId: user.id, after: JSON.stringify(changes) },
  })
  return NextResponse.json({ club })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user, 'club:write', id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const before = await db.club.findUnique({ where: { id } })
  await db.club.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'delete', entity: 'Club', entityId: id, userId: user.id, before: JSON.stringify({ id: before?.id, name: before?.name }) },
  })
  return NextResponse.json({ success: true })
}
