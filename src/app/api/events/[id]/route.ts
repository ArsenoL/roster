import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await db.event.findUnique({
    where: { id },
    include: {
      club: true,
      attendances: {
        include: {
          user: { select: { id: true, name: true, email: true, studentId: true, grade: true, avatar: true } }
        },
        orderBy: { user: { name: 'asc' } },
      },
      _count: { select: { checkIns: true } },
    }
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ event })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const before = await db.event.findUnique({ where: { id } })
  const event = await db.event.update({
    where: { id },
    data: {
      ...body,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
    }
  })
  await db.auditLog.create({
    data: { action: 'update', entity: 'Event', entityId: id, clubId: event.clubId, before: JSON.stringify(before), after: JSON.stringify(event) }
  })
  return NextResponse.json({ event })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const before = await db.event.findUnique({ where: { id } })
  await db.event.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'delete', entity: 'Event', entityId: id, clubId: before?.clubId, before: JSON.stringify(before) }
  })
  return NextResponse.json({ success: true })
}
