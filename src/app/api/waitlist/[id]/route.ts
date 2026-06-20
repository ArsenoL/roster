import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/waitlist/[id] — remove from waitlist (manually or after promotion)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entry = await db.eventWaitlist.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
