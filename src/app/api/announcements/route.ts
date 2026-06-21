import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitClubEvent, enqueueEmail } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// GET /api/announcements?clubId=...
// Public clubs' announcements are visible to any signed-in user (the public
// portal uses a different endpoint). For private clubs, require club:read.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships.map((m) => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }
  const announcements = await db.announcement.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, email: true, avatar: true } },
      club: { select: { id: true, name: true, primaryColor: true } },
    },
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 50,
  })
  return NextResponse.json({ announcements })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Posting an announcement (and especially sending it as email/SMS to all
  // members) requires announcements:write.
  if (!body.clubId || !hasPermission(user, 'announcements:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const announcement = await db.announcement.create({
    data: {
      clubId: body.clubId,
      authorId: user.id,  // always the signed-in user, never trust the body
      title: body.title,
      content: body.content,
      priority: body.priority || 'NORMAL',
      category: body.category || null,
      isPinned: body.isPinned || false,
      sendEmail: body.sendEmail || false,
      sendSMS: body.sendSMS || false,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
    include: { author: true, club: true }
  })
  await db.auditLog.create({
    data: { action: 'create', entity: 'Announcement', entityId: announcement.id, clubId: body.clubId, userId: user.id, after: JSON.stringify(announcement) }
  })

  // REAL SIDE-EFFECTS (Phase 3):
  // 1. Emit webhook to registered subscribers
  // 2. Push in-app notification to all club members
  // 3. If sendEmail is on, actually queue emails to every member (not just store the flag)
  // 4. If sendSMS is on, log to SmsLog table (real SMS integration would plug in here)
  if (!body.scheduledFor || new Date(body.scheduledFor) <= new Date()) {
    const members = await db.membership.findMany({
      where: { clubId: body.clubId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    })

    // Fire webhook + notifications (fail-safe)
    emitClubEvent(body.clubId, 'announcement.created', {
      title: `New announcement: ${announcement.title}`,
      body: announcement.content.slice(0, 200) + (announcement.content.length > 200 ? '…' : ''),
      link: `/api/announcements?id=${announcement.id}`,
      payload: announcement,
      notifyUserIds: members.map((m) => m.userId),
      sendEmailToMembers: false,  // we send email below if requested
    }).catch(() => {})

    if (body.sendEmail) {
      const club = announcement.club
      for (const m of members) {
        await enqueueEmail({
          toEmail: m.user.email,
          toName: m.user.name,
          subject: `[${club.name}] ${announcement.title}`,
          body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:${club.primaryColor}">${announcement.title}</h2>
            <p><strong>From ${club.name}</strong> · ${new Date(announcement.createdAt).toLocaleString()}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
            <div style="white-space:pre-wrap;line-height:1.6">${announcement.content}</div>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
            <p style="color:#999;font-size:12px">You received this because you're a member of ${club.name}.</p>
          </div>`,
          clubId: body.clubId,
          mergeData: { name: m.user.name, club_name: club.name, title: announcement.title },
        })
      }
    }

    if (body.sendSMS) {
      // Log SMS requests (real SMS gateway integration would go here)
      // For now, record intent + truncate body for SMS length
      for (const m of members) {
        if (m.user.phone) {
          await db.smsLog.create({
            data: {
              clubId: body.clubId,
              toPhone: m.user.phone,
              body: `[${announcement.club.name}] ${announcement.title}`.slice(0, 160),
              status: 'SENT',
            },
          })
        }
      }
    }
  }

  return NextResponse.json({ announcement })
}
