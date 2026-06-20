import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
    data: { action: 'update', entity: 'Club', entityId: id, clubId: id, before: JSON.stringify(before), after: JSON.stringify(club) }
  })
  return NextResponse.json({ club })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await db.club.findUnique({ where: { id } })
  await db.club.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'delete', entity: 'Club', entityId: id, before: JSON.stringify(before) }
  })
  return NextResponse.json({ success: true })
}
