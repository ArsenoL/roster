import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership before updating.
  const existing = await db.savedView.findUnique({ where: { id }, select: { userId: true, tab: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.filters !== undefined) update.filters = JSON.stringify(body.filters)
  if (body.isDefault !== undefined) {
    if (body.isDefault) {
      await db.savedView.updateMany({
        where: { userId: user.id, tab: existing.tab },
        data: { isDefault: false },
      })
    }
    update.isDefault = body.isDefault
  }
  const view = await db.savedView.update({ where: { id }, data: update })
  return NextResponse.json({ view })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.savedView.findUnique({ where: { id }, select: { userId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.savedView.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
