import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.task.findUnique({ where: { id }, select: { clubId: true, assigneeId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Allow the assignee to update their own task (e.g. mark done) without
  // requiring club:write — that's the basic user flow. Anyone else needs
  // club:write on the task's club.
  const isAssignee = existing.assigneeId === user.id
  if (!isAssignee && !hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  const data: any = {}
  for (const k of ['title', 'description', 'status', 'priority', 'assigneeId', 'committeeId', 'listId', 'estimatedMinutes', 'actualMinutes']) {
    if (body[k] !== undefined) data[k] = body[k]
  }
  if (body.dueDate) data.dueDate = new Date(body.dueDate)
  if (body.tags) data.tags = JSON.stringify(body.tags)
  if (body.checklist) data.checklist = JSON.stringify(body.checklist)
  if (body.status === 'DONE') {
    data.completedAt = new Date()
  } else if (body.status && body.status !== 'DONE') {
    data.completedAt = null
  }

  const task = await db.task.update({ where: { id }, data })
  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.task.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
