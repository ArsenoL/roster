import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// PATCH /api/volunteer-hours/[id] — approve/reject (officers only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  const existing = await db.volunteerHours.findUnique({ where: { id }, select: { clubId: true, userId: true, status: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Two flows:
  //  1. Approve/reject (status === APPROVED|REJECTED) — requires members:write
  //     (officer approval workflow).
  //  2. Edit by the original submitter (status not changed) — allowed if self.
  const isApproval = body.status === 'APPROVED' || body.status === 'REJECTED'
  if (isApproval) {
    if (!hasPermission(user, 'members:write', existing.clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // Self-approval guard — a member can't approve their own hours, even if
    // they happen to hold an officer role that grants members:write.
    if (existing.userId === user.id) {
      return NextResponse.json({ error: 'cannot approve your own hours' }, { status: 403 })
    }
    // Terminal-state guard — once an entry has been APPROVED or REJECTED, it
    // can't be re-reviewed. (Allowing re-review would let an officer flip
    // approvals back and forth without an audit trail of the original
    // decision.)
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'already reviewed' }, { status: 409 })
    }
  } else if (existing.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data: any = {}
  if (body.status) data.status = body.status
  if (body.status === 'APPROVED') {
    data.approvedAt = new Date()
    data.approvedById = user.id  // always the signed-in user
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
      userId: user.id,
      after: JSON.stringify(h),
    },
  })

  return NextResponse.json(h)
}
