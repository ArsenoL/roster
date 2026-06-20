import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const data: any = { status: body.status, reviewedAt: new Date(), reviewedById: body.reviewedById || null }
  if (body.reviewNotes !== undefined) data.reviewNotes = body.reviewNotes
  if (body.rejectionReason !== undefined) data.rejectionReason = body.rejectionReason
  if (body.invitedToJoin !== undefined) data.invitedToJoin = body.invitedToJoin

  const app = await db.clubApplication.update({ where: { id }, data })

  // If accepted/invited, create a membership
  if (body.status === 'ACCEPTED' || body.status === 'INVITED') {
    // Try to find or create user by email
    let user = await db.user.findUnique({ where: { email: app.email } })
    if (!user) {
      user = await db.user.create({
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
    const existing = await db.membership.findUnique({
      where: { userId_clubId: { userId: user.id, clubId: app.clubId } },
    })
    if (!existing) {
      await db.membership.create({
        data: {
          userId: user.id,
          clubId: app.clubId,
          role: 'MEMBER',
          status: 'ACTIVE',
        },
      })
    }
  }

  return NextResponse.json(app)
}
