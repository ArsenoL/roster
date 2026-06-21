import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/custom-fields?clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  const fields = await db.customField.findMany({
    where,
    orderBy: { sortOrder: 'asc' }
  })
  return NextResponse.json({ fields })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const field = await db.customField.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      label: body.label,
      type: body.type,
      options: body.options ? JSON.stringify(body.options) : null,
      required: body.required || false,
      defaultValue: body.defaultValue || null,
      description: body.description || null,
      sortOrder: body.sortOrder || 0,
      isVisible: body.isVisible ?? true,
      isEditable: body.isEditable ?? true,
      appliesTo: body.appliesTo || 'member',
    }
  })
  await db.auditLog.create({
    data: { action: 'create', entity: 'CustomField', entityId: field.id, clubId: body.clubId, userId: user.id, after: JSON.stringify(field) }
  })
  return NextResponse.json({ field })
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.customField.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!existing.clubId || !hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Never allow clubId to be reassigned via PATCH.
  delete updates.clubId

  const field = await db.customField.update({
    where: { id },
    data: {
      ...updates,
      options: updates.options ? JSON.stringify(updates.options) : undefined,
    }
  })
  return NextResponse.json({ field })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const existing = await db.customField.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!existing.clubId || !hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.customField.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
