import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// PATCH /api/applications/[id] — review (accept / reject / waitlist / invite).
// Officers only — reviewing applications (and the side-effect of creating a
// Membership on ACCEPTED) requires members:write on the app's club.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.clubApplication.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'members:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  const data: any = { status: body.status, reviewedAt: new Date(), reviewedById: user.id }
  if (body.reviewNotes !== undefined) data.reviewNotes = body.reviewNotes
  if (body.rejectionReason !== undefined) data.rejectionReason = body.rejectionReason
  if (body.invitedToJoin !== undefined) data.invitedToJoin = body.invitedToJoin

  const app = await db.clubApplication.update({ where: { id }, data })

  // If accepted/invited, create a membership
  if (body.status === 'ACCEPTED' || body.status === 'INVITED') {
    // Try to find or create user by email
    let u = await db.user.findUnique({ where: { email: app.email } })
    if (!u) {
      u = await db.user.create({
        data: {
          email: app.email,
          name: app.name,
          studentId: app.studentId || undefined,
          grade: app.grade || undefined,
          role: 'STUDENT',
        },
      })
    }
    // Create membership if not exists
    const existsMem = await db.membership.findUnique({
      where: { userId_clubId: { userId: u.id, clubId: app.clubId } },
    })
    if (!existsMem) {
      await db.membership.create({
        data: {
          userId: u.id,
          clubId: app.clubId,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      })
    }
  }

  return NextResponse.json(app)
}
