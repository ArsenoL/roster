import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const includeResponses = url.searchParams.get('responses') === 'true'

  const form = await db.form.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      responses: includeResponses ? {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { submittedAt: 'desc' },
      } : false,
      _count: { select: { responses: true } },
    },
  })

  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ form })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { fields, ...formData } = body

  const data: any = { ...formData }
  if (formData.deadline) data.deadline = new Date(formData.deadline)

  const form = await db.form.update({ where: { id }, data })

  return NextResponse.json(form)
}

// Submit a form response
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const form = await db.form.findUnique({ where: { id } })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (form.status !== 'OPEN') return NextResponse.json({ error: 'Form closed' }, { status: 400 })

  const response = await db.formResponse.create({
    data: {
      formId: id,
      userId: body.userId || null,
      data: JSON.stringify(body.responses || {}),
      ipAddress: req.headers.get('x-forwarded-for') || null,
    },
  })

  return NextResponse.json(response)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.form.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
