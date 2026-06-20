import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/notifications?userId=...&unread=true
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const unreadOnly = url.searchParams.get('unread') === 'true'

  if (!userId) return NextResponse.json({ notifications: [], count: 0 })

  const where: any = { userId }
  if (unreadOnly) where.isRead = false

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.notification.count({ where: { userId, isRead: false } }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

// Create a notification (system use)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const n = await db.notification.create({
    data: {
      userId: body.userId,
      type: body.type || 'announcement',
      title: body.title,
      body: body.body || null,
      link: body.link || null,
      priority: body.priority || 'normal',
      clubId: body.clubId || null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })
  return NextResponse.json(n)
}

// Mark as read
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  if (body.markAllRead && body.userId) {
    await db.notification.updateMany({
      where: { userId: body.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }
  const n = await db.notification.update({
    where: { id: body.id },
    data: { isRead: true, readAt: new Date() },
  })
  return NextResponse.json(n)
}
