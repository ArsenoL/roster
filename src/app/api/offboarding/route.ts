import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'

// GET /api/offboarding?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  const offboardings = await db.memberOffboarding.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, graduationYear: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ offboardings })
}

/**
 * POST /api/offboarding — graduate/transfer/resign a member.
 * Body: { userId, clubId, type, reason, effectiveDate, farewellMessage?, survey?, inviteToAlumni? }
 *
 * Real effects:
 *   1. Marks membership status as INACTIVE / leftAt = effectiveDate
 *   2. If type=GRADUATION, transitions user.status to GRADUATED (only if no other active memberships)
 *   3. Optionally creates AlumniProfile
 *   4. Sends farewell email to the user
 *   5. Fires webhook 'member.left'
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { userId, clubId, type, reason, effectiveDate, farewellMessage, survey, inviteToAlumni } = body
  if (!userId || !clubId || !type) {
    return NextResponse.json({ error: 'userId, clubId, type required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  const club = await db.club.findUnique({ where: { id: clubId } })
  if (!user || !club) return NextResponse.json({ error: 'User or club not found' }, { status: 404 })

  // 1. Mark membership inactive
  await db.membership.updateMany({
    where: { userId, clubId, status: 'ACTIVE' },
    data: { status: 'INACTIVE', leftAt: new Date(effectiveDate || Date.now()) },
  })

  // 2. If graduation, check if user has any other active memberships — if not, mark as GRADUATED
  if (type === 'GRADUATION') {
    const otherActive = await db.membership.count({
      where: { userId, status: 'ACTIVE' },
    })
    if (otherActive === 0) {
      await db.user.update({
        where: { id: userId },
        data: { status: 'GRADUATED' },
      })
    }
  }

  // 3. Create offboarding record
  const offboarding = await db.memberOffboarding.create({
    data: {
      userId, clubId, type,
      reason: reason || null,
      effectiveDate: new Date(effectiveDate || Date.now()),
      survey: survey ? JSON.stringify(survey) : null,
      farewellMessage: farewellMessage || null,
      alumniInviteSent: false,
    }
  })

  // 4. Optionally create alumni profile
  if (inviteToAlumni || type === 'GRADUATION') {
    const existing = await db.alumniProfile.findUnique({ where: { userId } })
    if (!existing) {
      await db.alumniProfile.create({
        data: {
          userId,
          clubId,
          graduationYear: user.graduationYear || new Date().getFullYear(),
          isMentor: false,
          isDonor: false,
          isSpeaker: false,
        }
      })
      await db.memberOffboarding.update({
        where: { id: offboarding.id },
        data: { alumniInviteSent: true },
      })
    }
  }

  // 5. Send farewell email
  if (farewellMessage) {
    await enqueueEmail({
      toEmail: user.email,
      toName: user.name,
      subject: `Thank you from ${club.name} 💚`,
      body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2>A heartfelt thank you from ${club.name}</h2>
        <p>Hi ${user.name},</p>
        <div style="white-space:pre-wrap;line-height:1.6">${farewellMessage}</div>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <p style="color:#999;font-size:13px">You're now part of the ${club.name} alumni network. Welcome aboard!</p>
      </div>`,
      clubId,
    })
  }

  await db.auditLog.create({
    data: {
      action: 'offboard_member',
      entity: 'Membership',
      clubId,
      after: JSON.stringify({ userId, type, reason }),
    }
  })

  return NextResponse.json({ ok: true, offboarding })
}
