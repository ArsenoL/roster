import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const data: any = {}
  if (body.status) data.status = body.status
  if (body.title) data.title = body.title
  if (body.endDate) data.endDate = new Date(body.endDate)
  if (body.showResults !== undefined) data.showResults = body.showResults

  const poll = await db.poll.update({ where: { id }, data })
  return NextResponse.json(poll)
}

// POST /api/polls/[id] — cast a vote
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const poll = await db.poll.findUnique({ where: { id }, include: { options: true } })
  if (!poll) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (poll.status !== 'OPEN') return NextResponse.json({ error: 'Poll not open' }, { status: 400 })

  // Remove existing votes by this user (allows revoting)
  await db.pollVote.deleteMany({ where: { pollId: id, userId: body.userId } })

  const optionIds = body.optionIds || (body.rankings || []).map((r: any) => r.optionId)
  if (optionIds.length === 0) return NextResponse.json({ error: 'No option selected' }, { status: 400 })

  if (poll.type === 'SINGLE_CHOICE' && optionIds.length > 1) {
    return NextResponse.json({ error: 'Single choice only' }, { status: 400 })
  }

  const votes = await Promise.all(optionIds.map(async (oid: string) => {
    const rank = body.rankings ? body.rankings.find((r: any) => r.optionId === oid)?.rank || 0 : 0
    return db.pollVote.create({
      data: { pollId: id, optionId: oid, userId: body.userId, rank },
    })
  }))

  return NextResponse.json({ votes })
}
