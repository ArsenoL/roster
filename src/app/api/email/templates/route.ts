import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail, mergeTemplate } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/email/templates?clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    // Email templates may contain merge variables that expose member PII —
    // require announcements:write (officer+) to view.
    if (!hasPermission(user, 'announcements:write', clubId) && !hasPermission(user, 'club:write', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'announcements:write', m.clubId) || hasPermission(user, 'club:write', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  const templates = await db.emailTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ templates })
}

// POST /api/email/templates — create or save a template
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.clubId || !hasPermission(user, 'announcements:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tpl = await db.emailTemplate.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      subject: body.subject,
      body: body.body,
      type: body.type || 'custom',
    },
  })

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'EmailTemplate',
      entityId: tpl.id,
      clubId: body.clubId,
      userId: user.id,
      after: JSON.stringify(tpl),
    },
  })

  return NextResponse.json({ template: tpl })
}
