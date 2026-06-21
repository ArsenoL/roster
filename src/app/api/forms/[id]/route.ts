import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  // Reading a form (and especially its responses) requires club:read on the
  // form's club.
  if (!hasPermission(user, 'club:read', form.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ form })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.form.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { fields, ...formData } = body

  const data: any = {}
  // Whitelist updatable fields
  for (const k of ['title', 'description', 'type', 'status', 'isAnonymous', 'allowMultipleResponses', 'collectName', 'successMessage']) {
    if (formData[k] !== undefined) data[k] = formData[k]
  }
  if (formData.deadline !== undefined) data.deadline = formData.deadline ? new Date(formData.deadline) : null

  const form = await db.form.update({ where: { id }, data })

  return NextResponse.json(form)
}

// Submit a form response
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await db.form.findUnique({ where: { id } })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Submissions are open to any signed-in user who can read the club
  // (i.e. a member of the club, or an admin).
  if (!hasPermission(user, 'club:read', form.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (form.status !== 'OPEN') return NextResponse.json({ error: 'Form closed' }, { status: 400 })

  const body = await req.json()

  const response = await db.formResponse.create({
    data: {
      formId: id,
      userId: user.id,  // always the signed-in user — never trust body.userId
      data: JSON.stringify(body.responses || {}),
      ipAddress: req.headers.get('x-forwarded-for') || null,
    },
  })

  return NextResponse.json(response)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.form.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.form.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
