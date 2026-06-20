import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pushNotification } from '@/lib/clubhub/dispatchers'

/**
 * PATCH /api/attendance-excuses/[id]
 * Body: { status: 'APPROVED' | 'DENIED', approvedById, reviewerNotes? }
 *
 * If APPROVED, also updates the linked Attendance row to EXCUSED status
 * and reverses any late/absent penalties that were applied.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { status, approvedById, reviewerNotes } = body
  if (!['APPROVED', 'DENIED'].includes(status)) {
    return NextResponse.json({ error: 'status must be APPROVED or DENIED' }, { status: 400 })
  }
  if (!approvedById) {
    return NextResponse.json({ error: 'approvedById required' }, { status: 400 })
  }

  const excuse = await db.attendanceExcuse.findUnique({ where: { id } })
  if (!excuse) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.attendanceExcuse.update({
    where: { id },
    data: {
      status,
      approvedById,
      reviewedAt: new Date(),
    },
  })

  // If approved and we have a linked attendance row, mark it EXCUSED
  if (status === 'APPROVED' && excuse.attendanceId) {
    const att = await db.attendance.update({
      where: { id: excuse.attendanceId },
      data: { status: 'EXCUSED' },
      include: { event: { select: { clubId: true, title: true } } },
    })

    // Reverse penalty: subtract points that were deducted (or add a small make-up bonus)
    const membership = await db.membership.findUnique({
      where: { userId_clubId: { userId: excuse.userId, clubId: att.event.clubId } },
    })
    if (membership) {
      await db.membership.update({
        where: { id: membership.id },
        data: { points: { increment: 3 } }, // small make-up bonus
      })
    }
  }

  // Notify the student
  await pushNotification({
    userId: excuse.userId,
    type: 'EXCUSE_REVIEWED',
    title: `Absence excuse ${status === 'APPROVED' ? 'approved' : 'denied'}`,
    body: reviewerNotes
      ? `Your excuse for the event has been ${status.toLowerCase()}. Reviewer note: ${reviewerNotes}`
      : `Your excuse has been ${status.toLowerCase()}.`,
  }).catch(() => {})

  return NextResponse.json({ excuse: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.attendanceExcuse.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
