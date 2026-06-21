import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.poll.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'announcements:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const poll = await db.poll.findUnique({ where: { id }, include: { options: true } })
  if (!poll) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Voting requires membership (club:read) — only members of the club can vote.
  if (!hasPermission(user, 'club:read', poll.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (poll.status !== 'OPEN') return NextResponse.json({ error: 'Poll not open' }, { status: 400 })

  // Remove existing votes by this user (allows revoting) — always use the
  // signed-in user's ID, never trust body.userId.
  await db.pollVote.deleteMany({ where: { pollId: id, userId: user.id } })

  const body = await req.json()
  const optionIds = body.optionIds || (body.rankings || []).map((r: any) => r.optionId)
  if (optionIds.length === 0) return NextResponse.json({ error: 'No option selected' }, { status: 400 })

  if (poll.type === 'SINGLE_CHOICE' && optionIds.length > 1) {
    return NextResponse.json({ error: 'Single choice only' }, { status: 400 })
  }

  const votes = await Promise.all(optionIds.map(async (oid: string) => {
    const rank = body.rankings ? body.rankings.find((r: any) => r.optionId === oid)?.rank || 0 : 0
    return db.pollVote.create({
      data: { pollId: id, optionId: oid, userId: user.id, rank },
    })
  }))

  return NextResponse.json({ votes })
}
