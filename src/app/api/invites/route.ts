import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'

// GET /api/invites?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  const invites = await db.clubInvite.findMany({
    where,
    include: { club: { select: { name: true, primaryColor: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ invites })
}

// POST /api/invites — create one or more invites and email them
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { clubId, emails, role, invitedBy } = body
  if (!clubId || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'clubId and emails[] required' }, { status: 400 })
  }

  const club = await db.club.findUnique({ where: { id: clubId } })
  if (!club) return NextResponse.json({ error: 'Club not found' }, { status: 404 })

  const created: any[] = []
  for (const email of emails) {
    const { randomBytes } = await import('crypto')
    const token = randomBytes(24).toString('hex')
    const invite = await db.clubInvite.create({
      data: {
        clubId,
        email: email.toLowerCase().trim(),
        role: role || 'MEMBER',
        token,
        invitedBy: invitedBy || null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),  // 7 days
      }
    })
    created.push(invite)

    // Send real invite email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const link = `${baseUrl}/join/${token}`
    await enqueueEmail({
      toEmail: invite.email,
      subject: `You're invited to join ${club.name}`,
      body: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px">
        <h2>You've been invited to ${club.name}</h2>
        <p>You've been invited to join <strong>${club.name}</strong> as a ${invite.role.toLowerCase().replace('_', ' ')}.</p>
        <p style="margin:30px 0">
          <a href="${link}" style="background:${club.primaryColor};color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Accept invite</a>
        </p>
        <p style="color:#999;font-size:13px">This invite expires in 7 days. If you weren't expecting it, you can safely ignore this email.</p>
      </div>`,
      clubId,
      mergeData: { club_name: club.name, role: invite.role, link },
    })
  }

  await db.auditLog.create({
    data: { action: 'create', entity: 'ClubInvite', clubId, after: JSON.stringify({ count: created.length, role }) }
  })

  return NextResponse.json({ invites: created, count: created.length })
}
