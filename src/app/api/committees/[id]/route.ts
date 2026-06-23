import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.committee.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  const data: any = {}
  for (const k of ['name', 'description', 'leadId', 'color', 'parentId']) {
    if (body[k] !== undefined) data[k] = body[k]
  }

  const c = await db.committee.update({ where: { id }, data, include: { members: true } })

  // Sync members if provided. Wrap deleteMany + createMany in a transaction
  // so a crash between them can't leave the committee with zero members
  // (the old member set already deleted, the new set not yet written).
  if (body.memberIds) {
    await db.$transaction([
      db.committeeMember.deleteMany({ where: { committeeId: id } }),
      ...(body.memberIds.length > 0
        ? [db.committeeMember.createMany({
            data: body.memberIds.map((uid: string) => ({ committeeId: id, userId: uid, role: 'member' })),
          })]
        : []),
    ])
  }

  return NextResponse.json(c)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.committee.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.committee.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
