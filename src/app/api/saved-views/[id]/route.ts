import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.filters !== undefined) update.filters = JSON.stringify(body.filters)
  if (body.isDefault !== undefined) {
    if (body.isDefault) {
      const view = await db.savedView.findUnique({ where: { id } })
      if (view) {
        await db.savedView.updateMany({
          where: { userId: view.userId, tab: view.tab },
          data: { isDefault: false },
        })
      }
    }
    update.isDefault = body.isDefault
  }
  const view = await db.savedView.update({ where: { id }, data: update })
  return NextResponse.json({ view })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.savedView.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
