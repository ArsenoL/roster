import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')

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

  const committees = await db.committee.findMany({
    where,
    include: {
      lead: { select: { id: true, name: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true, email: true } } } },
      _count: { select: { tasks: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ committees })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const c = await db.committee.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      description: body.description || null,
      leadId: body.leadId || null,
      color: body.color || '#8b5cf6',
      parentId: body.parentId || null,
      members: body.memberIds?.length ? {
        create: body.memberIds.map((uid: string) => ({ userId: uid, role: 'member' })),
      } : undefined,
    },
    include: { members: true },
  })

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'Committee',
      entityId: c.id,
      clubId: body.clubId,
      userId: user.id,
      after: JSON.stringify(c),
    },
  })

  return NextResponse.json(c)
}
