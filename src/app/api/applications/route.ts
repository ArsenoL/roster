import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { clampStr, LIMITS } from '@/lib/clubhub/sanitize'

// GET /api/applications?clubId=...&status=...
// Reading applications (which contain applicant PII) is officer-only.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'applications')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')

  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    // Reading applications (which contain applicant PII) requires members:read.
    if (!hasPermission(user, 'members:read', clubId) && !hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'members:read', m.clubId) || hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  if (status) where.status = status

  const apps = await db.clubApplication.findMany({
    where,
    include: { club: { select: { id: true, name: true, primaryColor: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const summary = {
    total: apps.length,
    pending: apps.filter(a => a.status === 'PENDING').length,
    accepted: apps.filter(a => a.status === 'ACCEPTED').length,
    rejected: apps.filter(a => a.status === 'REJECTED').length,
    waitlisted: apps.filter(a => a.status === 'WAITLISTED').length,
  }

  return NextResponse.json({ applications: apps, summary })
}

// POST /api/applications — submit an application. Auth required.
export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'applications')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const currentUser = await getCurrentUser()
  if (!currentUser) return NextResponse.json({ error: 'Sign in to apply' }, { status: 401 })

  const name = clampStr(body.name || currentUser.name, LIMITS.NAME)
  const email = currentUser.email
  const userId = currentUser.id

  if (!name || !email) return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  if (!body.clubId) return NextResponse.json({ error: 'clubId is required' }, { status: 400 })

  const settings = await db.clubSetting.findUnique({ where: { clubId: body.clubId } })
  if (settings && settings.enableApplications === false) {
    return NextResponse.json({ error: 'Applications are not enabled for this club' }, { status: 403 })
  }

  const recent = await db.clubApplication.findFirst({
    where: { clubId: body.clubId, userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    select: { id: true },
  })
  if (recent) return NextResponse.json({ error: 'You already applied recently. Please wait before applying again.' }, { status: 429 })

  const app = await db.clubApplication.create({
    data: {
      clubId: body.clubId, userId, name, email,
      grade: body.grade ?? null,
      studentId: body.studentId || null,
      phone: body.phone || null,
      responses: JSON.stringify(body.responses || {}),
    },
  })

  const admins = await db.membership.findMany({
    where: { clubId: body.clubId, role: { in: ['PRESIDENT', 'VICE_PRESIDENT'] } },
    select: { userId: true },
  })
  const club = await db.club.findUnique({ where: { id: body.clubId }, select: { advisorId: true } })
  const userIds = new Set(admins.map(a => a.userId))
  if (club?.advisorId) userIds.add(club.advisorId)
  await Promise.all(Array.from(userIds).map(userId => db.notification.create({
    data: { userId, type: 'application', title: 'New application received', body: `${name} applied to join`, link: '/applications', priority: 'normal', clubId: body.clubId },
  }).catch(() => {})))

  return NextResponse.json(app)
}
