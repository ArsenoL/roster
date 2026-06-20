import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  return NextResponse.json({ resource })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const r = await db.resource.update({ where: { id }, data: body })
  return NextResponse.json(r)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.resource.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
