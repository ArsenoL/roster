import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { isClubMember } from '@/lib/clubhub/sanitize'

// GET /api/messages/conversations?clubId=...
// Always scoped to the signed-in user — userId is NOT accepted as a param
// (would be an IDOR allowing anyone to read another user's conversations).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'messages')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const userId = user.id  // always the signed-in user

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
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'messages')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const { clubId, type = 'DIRECT', title, participantIds, firstMessage } = body
  // Always include the signed-in user as a participant — never trust the
  // body's senderId.
  const participantSet = new Set<string>([user.id, ...(participantIds || [])])
  if (participantSet.size < 2) {
    return NextResponse.json({ error: 'At least 2 participants required' }, { status: 400 })
  }

  // If a clubId is provided, verify the caller can read that club.
  if (clubId && !hasPermission(user, 'club:read', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // When clubId is provided, validate that every OTHER participant (i.e.
  // every participant other than the caller) is an active member of that
  // club. Without this, a caller could open a conversation scoped to clubA
  // but invite participants who aren't members of clubA (cross-tenant
  // contact enumeration / message delivery).
  if (clubId) {
    for (const uid of participantSet) {
      if (uid === user.id) continue
      const ok = await isClubMember(uid, clubId)
      if (!ok) {
        return NextResponse.json({ error: `Participant ${uid} is not a member of this club` }, { status: 400 })
      }
    }
  }

  const participantArray = Array.from(participantSet)

  // For DIRECT conversations, check if one already exists between these 2 users
  if (type === 'DIRECT' && participantArray.length === 2) {
    const existing = await db.conversation.findFirst({
      where: {
        type: 'DIRECT',
        clubId: clubId || null,
        participants: {
          every: { userId: { in: participantArray } },
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
        create: participantArray.map((uid: string) => ({ userId: uid })),
      },
      messages: firstMessage ? {
        create: { senderId: user.id, body: firstMessage },
      } : undefined,
    },
    include: {
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })

  return NextResponse.json({ conversation: conv })
}
