import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const update: any = {}
  if (body.content !== undefined) update.content = body.content
  if (body.attendance !== undefined) update.attendance = JSON.stringify(body.attendance)
  if (body.decisions !== undefined) update.decisions = JSON.stringify(body.decisions)
  if (body.actionItems !== undefined) update.actionItems = JSON.stringify(body.actionItems)
  if (body.nextMeeting !== undefined) update.nextMeeting = body.nextMeeting

  // Approval flow
  if (body.approve && !body.unapprove) {
    update.isApproved = true
    update.approvedById = body.approverId
    update.approvedAt = new Date()
  } else if (body.unapprove) {
    update.isApproved = false
    update.approvedById = null
    update.approvedAt = null
  }

  const minutes = await db.meetingMinutes.update({ where: { id }, data: update })
  return NextResponse.json({ minutes })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.meetingMinutes.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
