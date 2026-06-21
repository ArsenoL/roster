import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const listId = url.searchParams.get('listId')
  const assigneeId = url.searchParams.get('assigneeId')
  const committeeId = url.searchParams.get('committeeId')
  const status = url.searchParams.get('status')

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
  if (listId) where.listId = listId
  // Restrict assigneeId filter to the signed-in user (callers shouldn't be
  // able to enumerate other users' tasks via this filter). Admins can pass
  // any assigneeId.
  if (assigneeId) {
    if (assigneeId !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.assigneeId = assigneeId
  }
  if (committeeId) where.committeeId = committeeId
  if (status) where.status = status

  const [tasks, lists] = await Promise.all([
    db.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        creator: { select: { id: true, name: true } },
        committee: { select: { id: true, name: true, color: true } },
        list: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    db.taskList.findMany({
      where: clubId && clubId !== 'ALL' ? { clubId, isArchived: false } : { isArchived: false },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'TODO').length,
    inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
    done: tasks.filter(t => t.status === 'DONE').length,
    blocked: tasks.filter(t => t.status === 'BLOCKED').length,
    overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length,
  }

  return NextResponse.json({ tasks, lists, stats })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const task = await db.task.create({
    data: {
      clubId: body.clubId,
      listId: body.listId || null,
      title: body.title,
      description: body.description || null,
      status: body.status || 'TODO',
      priority: body.priority || 'MEDIUM',
      assigneeId: body.assigneeId || null,
      creatorId: user.id,  // always the signed-in user
      committeeId: body.committeeId || null,
      eventId: body.eventId || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      estimatedMinutes: body.estimatedMinutes || null,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      checklist: body.checklist ? JSON.stringify(body.checklist) : null,
    },
  })

  // Send notification to assignee
  if (body.assigneeId) {
    await db.notification.create({
      data: {
        userId: body.assigneeId,
        type: 'task_assigned',
        title: 'New task assigned',
        body: body.title,
        link: `/tasks`,
        priority: 'normal',
        clubId: body.clubId,
      },
    })
  }

  return NextResponse.json(task)
}
