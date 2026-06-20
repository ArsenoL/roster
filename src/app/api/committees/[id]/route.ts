import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const data: any = {}
  for (const k of ['name', 'description', 'leadId', 'color', 'parentId']) {
    if (body[k] !== undefined) data[k] = body[k]
  }

  const c = await db.committee.update({ where: { id }, data, include: { members: true } })

  // Sync members if provided
  if (body.memberIds) {
    await db.committeeMember.deleteMany({ where: { committeeId: id } })
    if (body.memberIds.length > 0) {
      await db.committeeMember.createMany({
        data: body.memberIds.map((uid: string) => ({ committeeId: id, userId: uid, role: 'member' })),
      })
    }
  }

  return NextResponse.json(c)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.committee.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
