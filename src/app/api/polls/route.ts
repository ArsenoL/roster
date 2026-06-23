import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/polls?clubId=...&status=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'polls')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')
  // Ignore voterId from query — always use the signed-in user to prevent IDOR.
  const voterId = user.id

  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
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

  const votes = await db.pollVote.findMany({
    where: { userId: voterId, pollId: { in: polls.map(p => p.id) } },
    select: { pollId: true, optionId: true },
  })

  const enriched = polls.map(p => {
    const totalVotes = p.options.reduce((s, o) => s + o._count.votes, 0)
    return {
      ...p,
      userVoted: votes.some(v => v.pollId === p.id),
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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'polls')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'announcements:write', body.clubId)) {
    // Polls are an engagement feature — same write tier as announcements.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { options, clubId, title, description, type, startDate, endDate, showResults, allowMultiple, allowAnonymous, eventId, isOfficial, eligibility } = body
  const poll = await db.poll.create({
    data: {
      clubId,
      title,
      description: description || null,
      type: type || 'SINGLE_CHOICE',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      status: 'OPEN',
      showResults: showResults ?? true,
      allowMultiple: allowMultiple ?? false,
      allowAnonymous: allowAnonymous ?? true,
      eventId: eventId || null,
      isOfficial: isOfficial ?? false,
      eligibility: eligibility ?? null,
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
      clubId,
      userId: user.id,
      after: JSON.stringify(poll),
    },
  })

  return NextResponse.json(poll)
}
