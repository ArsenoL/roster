import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const update: any = {}
  if (body.name !== undefined) update.name = body.name
  if (body.url !== undefined) update.url = body.url
  if (body.events !== undefined) update.events = JSON.stringify(body.events)
  if (body.isActive !== undefined) update.isActive = body.isActive
  const webhook = await db.webhook.update({ where: { id }, data: update })
  return NextResponse.json({ webhook })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.webhook.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
