import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/messages/conversations/[id]?userId=... — fetch messages + mark read
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')

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

  // Mark read for the requesting user
  if (userId) {
    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId },
      data: { lastReadAt: new Date() },
    })
  }

  return NextResponse.json({ conversation: conv })
}

// POST /api/messages/conversations/[id] — send a message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { senderId, body: messageBody, attachments } = body
  if (!senderId || !messageBody) {
    return NextResponse.json({ error: 'senderId and body required' }, { status: 400 })
  }

  const msg = await db.message.create({
    data: {
      conversationId: id,
      senderId,
      body: messageBody,
      attachments: attachments ? JSON.stringify(attachments) : null,
    },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  })

  // Bump conversation updatedAt
  await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } })

  // Push notifications to other participants
  const participants = await db.conversationParticipant.findMany({
    where: { conversationId: id, userId: { not: senderId } },
    select: { userId: true },
  })
  const sender = await db.user.findUnique({ where: { id: senderId }, select: { name: true } })
  await Promise.all(participants.map(p =>
    db.notification.create({
      data: {
        userId: p.userId,
        type: 'MESSAGE',
        title: `${sender?.name} sent you a message`,
        body: messageBody.slice(0, 200),
        link: `/api/messages/conversations/${id}`,
      },
    }).catch(() => {})
  ))

  return NextResponse.json({ message: msg })
}

// PATCH /api/messages/conversations/[id] — edit/delete message
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  if (body.markRead && body.userId) {
    await db.conversationParticipant.updateMany({
      where: { conversationId: id, userId: body.userId },
      data: { lastReadAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unsupported' }, { status: 400 })
}
