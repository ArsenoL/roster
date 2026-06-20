import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/clubhub/auth'
import { verifyModule } from '@/lib/clubhub/module-gate'

export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'applications')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
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

export async function POST(req: NextRequest) {
  const __gate = await verifyModule(req, 'applications')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()

  // If the caller is signed in and didn't provide name/email, auto-fill from their account.
  // This is used by the onboarding wizard so applicants don't have to retype their info.
  const currentUser = await getCurrentUser()
  const name = body.name || currentUser?.name || ''
  const email = body.email || currentUser?.email || ''
  const userId = body.userId || currentUser?.id || null

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const app = await db.clubApplication.create({
    data: {
      clubId: body.clubId,
      userId,
      name,
      email,
      grade: body.grade ?? null,
      studentId: body.studentId || null,
      phone: body.phone || null,
      responses: JSON.stringify(body.responses || {}),
    },
  })

  // Notify club admins (president + VP). The faculty advisor is a User.role
  // (global), not a MembershipRole — we look them up via Club.advisorId below.
  const admins = await db.membership.findMany({
    where: { clubId: body.clubId, role: { in: ['PRESIDENT', 'VICE_PRESIDENT'] } },
    select: { userId: true },
  })
  // Also include the club's faculty advisor if one is set.
  const club = await db.club.findUnique({
    where: { id: body.clubId },
    select: { advisorId: true },
  })
  const userIds = new Set(admins.map(a => a.userId))
  if (club?.advisorId) userIds.add(club.advisorId)
  await Promise.all(Array.from(userIds).map(userId => db.notification.create({
    data: {
      userId,
      type: 'application',
      title: 'New application received',
      body: `${name} applied to join`,
      link: '/applications',
      priority: 'normal',
      clubId: body.clubId,
    },
  })))

  return NextResponse.json(app)
}
