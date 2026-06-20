import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/polls?clubId=...&status=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'polls')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')
  const voterId = url.searchParams.get('voterId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (status) where.status = status

  const polls = await db.poll.findMany({
    where,
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  let userVotes: { pollId: string, optionId: string }[] = []
  if (voterId) {
    const votes = await db.pollVote.findMany({
      where: { userId: voterId, pollId: { in: polls.map(p => p.id) } },
      select: { pollId: true, optionId: true },
    })
    userVotes = votes
  }

  const enriched = polls.map(p => {
    const totalVotes = p.options.reduce((s, o) => s + o._count.votes, 0)
    return {
      ...p,
      userVoted: voterId ? userVotes.some(v => v.pollId === p.id) : false,
      options: p.options.map(o => ({
        ...o,
        voteShare: totalVotes > 0 ? (o._count.votes / totalVotes) * 100 : 0,
      })),
    }
  })

  return NextResponse.json({ polls: enriched })
}

// POST /api/polls
export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'polls')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const { options, ...pollData } = body

  const poll = await db.poll.create({
    data: {
      ...pollData,
      startDate: pollData.startDate ? new Date(pollData.startDate) : new Date(),
      endDate: new Date(pollData.endDate),
      options: {
        create: (options || []).map((o: any, i: number) => ({
          text: o.text,
          description: o.description || null,
          color: o.color || null,
          imageUrl: o.imageUrl || null,
          candidateUserId: o.candidateUserId || null,
          sortOrder: i,
        })),
      },
    },
    include: { options: true },
  })

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'Poll',
      entityId: poll.id,
      clubId: poll.clubId,
      after: JSON.stringify(poll),
    },
  })

  return NextResponse.json(poll)
}
