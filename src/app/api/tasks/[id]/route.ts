import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  await db.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
