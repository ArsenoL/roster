import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/clubhub/auth'

// GET /api/messages/conversations/[id] — fetch messages + mark read
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conv = await db.conversation.findUnique({
    where: { id },
    include: {
      participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 200,
        include: { sender: { select: { id: true, name: true, avatar: true } } },
      },
      club: { select: { id: true, name: true, primaryColor: true } },
    },
  })
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify the caller is a participant in this conversation (IDOR guard).
  const isParticipant = conv.participants.some(p => p.userId === user.id)
  if (!isParticipant) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Mark read for the requesting user
  await db.conversationParticipant.updateMany({
    where: { conversationId: id, userId: user.id },
    data: { lastReadAt: new Date() },
  })

  return NextResponse.json({ conversation: conv })
}

// POST /api/messages/conversations/[id] — send a message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the caller is a participant.
  const participation = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { userId: user.id, conversationId: id } },
  })
  if (!participation) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { body: messageBody, attachments } = body
  if (!messageBody) {
    return NextResponse.json({ error: 'body required' }, { status: 400 })
  }

  const msg = await db.message.create({
    data: {
      conversationId: id,
      senderId: user.id,  // always the signed-in user
      body: messageBody,
      attachments: attachments ? JSON.stringify(attachments) : null,
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  // Bump conversation updatedAt
  await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } })

  // Push notifications to other participants
  const participants = await db.conversationParticipant.findMany({
    where: { conversationId: id, userId: { not: user.id } },
    select: { userId: true },
  })
  await Promise.all(participants.map(p =>
    db.notification.create({
      data: {
        userId: p.userId,
        type: 'MESSAGE',
        title: `${user.name} sent you a message`,
        body: messageBody.slice(0, 200),
        link: `/api/messages/conversations/${id}`,
      },
    }).catch(() => {})
  ))

  return NextResponse.json({ message: msg })
}

// PATCH /api/messages/conversations/[id] — mark read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (body.markRead) {
    // Verify the caller is a participant before marking read.
    const participation = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { userId: user.id, conversationId: id } },
    })
    if (!participation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: user.id },
      data: { lastReadAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported' }, { status: 400 })
}
