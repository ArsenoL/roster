import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook } from '@/lib/clubhub/dispatchers'

/**
 * POST /api/invites/accept
 * Body: { token, name?, grade?, studentId?, phone? }
 * Accepts an invite — creates or finds user + creates membership.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, name, grade, studentId, phone } = body
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const invite = await db.clubInvite.findUnique({
    where: { token },
    include: { club: true },
  })
  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 })
  if (invite.acceptedAt) return NextResponse.json({ error: 'Invite already used' }, { status: 400 })
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invite expired' }, { status: 400 })
  }

  // Find or create user
  let user = await db.user.findUnique({ where: { email: invite.email } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: invite.email,
        name: name || invite.email.split('@')[0],
        grade: grade ? parseInt(grade) : null,
        studentId: studentId || null,
        phone: phone || null,
        role: 'STUDENT',
      }
    })
  } else if (name || grade || studentId || phone) {
    // Update missing fields only
    const update: any = {}
    if (!user.name && name) update.name = name
    if (!user.grade && grade) update.grade = parseInt(grade)
    if (!user.studentId && studentId) update.studentId = studentId
    if (!user.phone && phone) update.phone = phone
    if (Object.keys(update).length) {
      user = await db.user.update({ where: { id: user.id }, data: update })
    }
  }

  // Create membership (idempotent)
  const existing = await db.membership.findUnique({
    where: { userId_clubId: { userId: user.id, clubId: invite.clubId } },
  })
  if (!existing) {
    await db.membership.create({
      data: {
        userId: user.id,
        clubId: invite.clubId,
        role: invite.role,
        joinedAt: new Date(),
        status: 'ACTIVE',
      }
    })

    // Fire webhook for new member
    emitWebhook(invite.clubId, 'member.joined', {
      userId: user.id, name: user.name, email: user.email, role: invite.role,
      source: 'invite', inviteId: invite.id,
    }).catch(() => {})
  }

  // Mark invite accepted
  await db.clubInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() }
  })

  await db.auditLog.create({
    data: {
      action: 'accept_invite',
      entity: 'ClubInvite',
      entityId: invite.id,
      clubId: invite.clubId,
      after: JSON.stringify({ userId: user.id, role: invite.role }),
    }
  })

  return NextResponse.json({
    ok: true,
    club: { id: invite.club.id, name: invite.club.name, primaryColor: invite.club.primaryColor },
    user: { id: user.id, name: user.name, email: user.email },
  })
}
