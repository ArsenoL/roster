import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const data: any = { status: body.status }
  if (body.status === 'APPROVED') {
    data.approvedAt = new Date()
    data.approvedById = body.approvedById || null
  } else if (body.status === 'REJECTED') {
    data.rejectedReason = body.rejectedReason || null
  }

  const h = await db.volunteerHours.update({ where: { id }, data })

  await db.auditLog.create({
    data: {
      action: 'update',
      entity: 'VolunteerHours',
      entityId: id,
      clubId: h.clubId,
      after: JSON.stringify(h),
    },
  })

  return NextResponse.json(h)
}
