import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId

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
  const body = await req.json()
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

  return NextResponse.json(c)
}
