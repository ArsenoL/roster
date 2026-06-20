import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

// GET /api/messages/conversations?userId=...&clubId=...
export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'messages')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const clubId = url.searchParams.get('clubId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const participations = await db.conversationParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, name: true } } },
          },
          club: { select: { id: true, name: true, primaryColor: true } },
        },
      },
    },
    orderBy: { conversation: { updatedAt: 'desc' } },
  })

  // Filter by clubId if specified
  const filtered = clubId && clubId !== 'ALL'
    ? participations.filter(p => p.conversation.clubId === clubId)
    : participations

  // Compute unread counts
  const conversations = filtered.map(p => {
    const conv = p.conversation
    return {
      id: conv.id,
      type: conv.type,
      title: conv.title,
      club: conv.club,
      participants: conv.participants,
      lastMessage: conv.messages[0] || null,
      lastReadAt: p.lastReadAt,
      unreadCount: 0, // will compute below
    }
  })

  // Compute unread counts
  for (const c of conversations) {
    const unread = await db.message.count({
      where: {
        conversationId: c.id,
        createdAt: { gt: c.lastReadAt || new Date(0) },
        senderId: { not: userId },
      },
    })
    c.unreadCount = unread
  }

  return NextResponse.json({ conversations })
}

// POST /api/messages/conversations — start a new conversation
export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'messages')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const { clubId, type = 'DIRECT', title, participantIds, firstMessage, senderId } = body
  if (!participantIds || participantIds.length < 2) {
    return NextResponse.json({ error: 'At least 2 participants required' }, { status: 400 })
  }

  // For DIRECT conversations, check if one already exists between these 2 users
  if (type === 'DIRECT' && participantIds.length === 2) {
    const existing = await db.conversation.findFirst({
      where: {
        type: 'DIRECT',
        clubId: clubId || null,
        participants: {
          every: { userId: { in: participantIds } },
        },
      },
      include: { participants: true },
    })
    if (existing && existing.participants.length === 2) {
      // Already exists — return it
      return NextResponse.json({ conversation: existing, existing: true })
    }
  }

  const conv = await db.conversation.create({
    data: {
      clubId: clubId || null,
      type,
      title: title || null,
      participants: {
        create: participantIds.map((uid: string) => ({ userId: uid })),
      },
      messages: firstMessage ? {
        create: { senderId, body: firstMessage },
      } : undefined,
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })

  return NextResponse.json({ conversation: conv })
}
