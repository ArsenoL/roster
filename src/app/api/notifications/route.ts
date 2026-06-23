import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/clubhub/auth'

// GET /api/notifications?unread=true
// Always scoped to the signed-in user — the userId query param is ignored
// (previously this was an IDOR: anyone could read anyone's notifications).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'

  const where: any = { userId: user.id }
  if (unreadOnly) where.isRead = false

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.notification.count({ where: { userId: user.id, isRead: false } }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

// Create a notification. This is invoked from server-side dispatchers (e.g.
// emitClubEvent), not from client code. For now we still require a signed-in
// caller — long-term this should move to an internal-only auth scheme.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN'
  if (!isAdmin) {
    return NextResponse.json({ error: 'Only administrators may push notifications to other users.' }, { status: 403 })
  }

  const body = await req.json()
  const targetUserId = isAdmin && body.userId ? body.userId : user.id
  const n = await db.notification.create({
    data: {
      userId: targetUserId,
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

// Mark as read — strictly scoped to the signed-in user's notifications.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (body.markAllRead) {
    await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }
  // Single-notification mark-as-read: verify ownership before updating.
  const target = await db.notification.findUnique({ where: { id: body.id }, select: { userId: true } })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (target.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const n = await db.notification.update({
    where: { id: body.id },
    data: { isRead: true, readAt: new Date() },
  })
  return NextResponse.json(n)
}
