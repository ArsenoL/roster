import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.meetingMinutes.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const update: any = {}
  if (body.content !== undefined) update.content = body.content
  if (body.attendance !== undefined) update.attendance = JSON.stringify(body.attendance)
  if (body.decisions !== undefined) update.decisions = JSON.stringify(body.decisions)
  if (body.actionItems !== undefined) update.actionItems = JSON.stringify(body.actionItems)
  if (body.nextMeeting !== undefined) update.nextMeeting = body.nextMeeting

  // Approval flow — approverId always the signed-in user
  if (body.approve && !body.unapprove) {
    update.isApproved = true
    update.approvedById = user.id
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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.meetingMinutes.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.meetingMinutes.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
