import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/offboarding?clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'offboarding')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
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
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'offboarding')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const { userId, clubId, type, reason, effectiveDate, farewellMessage, survey, inviteToAlumni } = body
  if (!userId || !clubId || !type) {
    return NextResponse.json({ error: 'userId, clubId, type required' }, { status: 400 })
  }

  // Offboarding a member requires members:write on the club. The signed-in
  // user can also offboard *themselves* (e.g. resign) without that perm.
  const isSelf = userId === user.id
  if (!isSelf && !hasPermission(user, 'members:write', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // For self-offboard, verify the caller is actually an active member of
  // the target club — otherwise any signed-in user could "resign from" a
  // club they were never in, creating a spurious offboarding record +
  // alumni profile + farewell email.
  if (isSelf) {
    const myMembership = await db.membership.findUnique({
      where: { userId_clubId: { userId, clubId } },
      select: { status: true },
    })
    if (!myMembership || myMembership.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Forbidden — you are not an active member of this club' }, { status: 403 })
    }
  }

  const targetUser = await db.user.findUnique({ where: { id: userId } })
  const club = await db.club.findUnique({ where: { id: clubId } })
  if (!targetUser || !club) return NextResponse.json({ error: 'User or club not found' }, { status: 404 })

  // Wrap the entire multi-step write in a transaction so a partial failure
  // can't leave the user half-offboarded (membership REMOVED but no
  // offboarding record, or alumni profile created but no farewell sent).
  const offboarding = await db.$transaction(async (tx) => {
    // 1. Mark membership inactive (MembershipStatus enum: ACTIVE / PROBATIONARY / ALUMNI / REMOVED — no INACTIVE).
    // We use REMOVED for offboarded members because it's the closest semantic match
    // (the membership is no longer active in any operational sense).
    await tx.membership.updateMany({
      where: { userId, clubId, status: 'ACTIVE' },
      data: { status: 'REMOVED', leftAt: new Date(effectiveDate || Date.now()) },
    })

    // 2. If graduation, check if user has any other active memberships — if not, mark as GRADUATED
    if (type === 'GRADUATION') {
      const otherActive = await tx.membership.count({
        where: { userId, status: 'ACTIVE' },
      })
      if (otherActive === 0) {
        await tx.user.update({
          where: { id: userId },
          data: { status: 'GRADUATED' },
        })
      }
    }

    // 3. Create offboarding record
    const ob = await tx.memberOffboarding.create({
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
      const existing = await tx.alumniProfile.findUnique({ where: { userId } })
      if (!existing) {
        await tx.alumniProfile.create({
          data: {
            userId,
            clubId,
            graduationYear: targetUser.graduationYear || new Date().getFullYear(),
            mentorshipAvailable: false,
          }
        })
        await tx.memberOffboarding.update({
          where: { id: ob.id },
          data: { alumniInviteSent: true },
        })
      }
    }

    // 5. Send farewell email (inside transaction so a failure before this
    // point skips the enqueue — we don't want to send a farewell email for
    // an offboarding that didn't actually land).
    if (farewellMessage) {
      await enqueueEmail({
        toEmail: targetUser.email,
        toName: targetUser.name,
        subject: `Thank you from ${club.name}`,
        body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>A heartfelt thank you from ${club.name}</h2>
          <p>Hi ${targetUser.name},</p>
          <div style="white-space:pre-wrap;line-height:1.6">${farewellMessage}</div>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
          <p style="color:#999;font-size:13px">You're now part of the ${club.name} alumni network. Welcome aboard!</p>
        </div>`,
        clubId,
      })
    }

    await tx.auditLog.create({
      data: {
        action: 'offboard_member',
        entity: 'Membership',
        clubId,
        userId: user.id,
        after: JSON.stringify({ userId, type, reason }),
      }
    })

    return ob
  })

  return NextResponse.json({ ok: true, offboarding })
}
