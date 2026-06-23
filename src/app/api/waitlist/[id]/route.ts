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

  // Auto-promote the next person in line. The naive `findFirst` + `update`
  // pair is a TOCTOU race — two concurrent DELETEs could both find the same
  // next entry and both "promote" it. Wrap them in a transaction and use an
  // atomic updateMany with `notifiedAt: null` filter as the claim gate. If
  // the claim returns count 0 (someone else got there first), refetch the
  // next entry and retry.
  if (entry.eventId) {
    const event = await db.event.findUnique({ where: { id: entry.eventId } })
    if (event) {
      await db.$transaction(async (tx) => {
        // Safety cap on retries — pathological case only.
        for (let attempt = 0; attempt < 50; attempt++) {
          const next = await tx.eventWaitlist.findFirst({
            where: { eventId: entry.eventId, notifiedAt: null },
            orderBy: { createdAt: 'asc' },
          })
          if (!next) break
          const claimed = await tx.eventWaitlist.updateMany({
            where: { id: next.id, notifiedAt: null },
            data: { notifiedAt: new Date(), promotedAt: new Date() },
          })
          if (claimed.count > 0) break
          // count === 0 → another concurrent DELETE claimed `next` between
          // our findFirst and our updateMany. Loop and refetch.
        }
      })
    }
  }

  return NextResponse.json({ ok: true })
}
