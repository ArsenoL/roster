import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// DELETE /api/waitlist/[id] — remove from waitlist (manually or after promotion)
// Officers can remove anyone; the original entrant can remove themselves.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entry = await db.eventWaitlist.findUnique({
    where: { id },
    include: { event: { select: { clubId: true } } },
  })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Owner can remove their own entry; otherwise require events:write.
  const isOwner = entry.userId === user.id
  if (!isOwner && !hasPermission(user, 'events:write', entry.event.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.eventWaitlist.delete({ where: { id } })

  // Auto-promote the next person in line
  if (entry.eventId) {
    const event = await db.event.findUnique({ where: { id: entry.eventId } })
    if (event) {
      const next = await db.eventWaitlist.findFirst({
        where: { eventId: entry.eventId, notifiedAt: null },
        orderBy: { createdAt: 'asc' },
      })
      if (next) {
        await db.eventWaitlist.update({
          where: { id: next.id },
          data: { notifiedAt: new Date(), promotedAt: new Date() },
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
