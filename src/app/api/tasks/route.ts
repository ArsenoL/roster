import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const listId = url.searchParams.get('listId')
  const assigneeId = url.searchParams.get('assigneeId')
  const committeeId = url.searchParams.get('committeeId')
  const status = url.searchParams.get('status')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (listId) where.listId = listId
  if (assigneeId) where.assigneeId = assigneeId
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

  // Stats
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
  const body = await req.json()
  const task = await db.task.create({
    data: {
      clubId: body.clubId,
      listId: body.listId || null,
      title: body.title,
      description: body.description || null,
      status: body.status || 'TODO',
      priority: body.priority || 'MEDIUM',
      assigneeId: body.assigneeId || null,
      creatorId: body.creatorId || null,
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
