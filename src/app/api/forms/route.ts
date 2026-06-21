import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest) {
  // Auth first — verifyModule() does a DB lookup, so checking it for an
  // unauthenticated caller would let them probe clubId existence.
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'forms')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
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
  if (status) where.status = status

  const forms = await db.form.findMany({
    where,
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ forms })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'forms')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Whitelist allowed fields — never spread body directly (would allow
  // the caller to set clubId to a club they don't own, or override internal
  // fields like createdAt/id).
  const { fields, title, description, type, deadline, status, isAnonymous, allowMultipleResponses, collectName, successMessage } = body
  const form = await db.form.create({
    data: {
      clubId: body.clubId,
      title,
      description: description || null,
      type: type || 'SURVEY',
      deadline: deadline ? new Date(deadline) : null,
      status: status || 'OPEN',
      isAnonymous: isAnonymous || false,
      allowMultipleResponses: allowMultipleResponses || false,
      collectName: collectName ?? true,
      successMessage: successMessage || null,
      fields: fields?.length ? {
        create: fields.map((f: any, i: number) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          options: f.options ? JSON.stringify(f.options) : null,
          required: f.required || false,
          defaultValue: f.defaultValue || null,
          description: f.description || null,
          sortOrder: i,
          isVisible: true,
          isEditable: true,
          appliesTo: 'form',
        })),
      } : undefined,
    },
    include: { fields: true },
  })

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'Form',
      entityId: form.id,
      clubId: body.clubId,
      userId: user.id,
      after: JSON.stringify(form),
    },
  })

  return NextResponse.json(form)
}
