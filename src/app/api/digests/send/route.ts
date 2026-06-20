import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'

/**
 * POST /api/digests/send
 * Body: { clubId?, userId?, frequency? } — if no args, send to all due subscribers.
 * Compiles each subscriber's recent activity and emails them a digest.
 *
 * This is invoked by a cron job (or admin "send now" button).
 */
export async function POST(req: NextRequest) {
  const body = await req.json() || {}
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const where: any = { isActive: true }
  if (body.userId) where.userId = body.userId
  if (body.clubId) where.clubId = body.clubId
  // Only send to subscribers whose frequency matches today's run
  if (!body.forceAll) {
    where.OR = [
      { lastSentAt: null },
      { lastSentAt: { lt: weekAgo } },
    ]
  }

  const subs = await db.digestSubscription.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      club: {
        select: {
          id: true, name: true, primaryColor: true,
          _count: { select: { members: true } },
        },
      },
    },
    take: 50,
  })

  let sent = 0
  for (const sub of subs) {
    // Gather the week's activity for this user in this club
    const [events, announcements, attendances, tasks] = await Promise.all([
      db.event.findMany({
        where: { clubId: sub.clubId, startTime: { gte: weekAgo, lte: now } },
        orderBy: { startTime: 'asc' },
        take: 10,
      }),
      db.announcement.findMany({
        where: { clubId: sub.clubId, createdAt: { gte: weekAgo } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.attendance.findMany({
        where: { userId: sub.userId, event: { clubId: sub.clubId, startTime: { gte: weekAgo } } },
        include: { event: { select: { title: true, startTime: true } } },
      }),
      db.task.findMany({
        where: { assigneeId: sub.userId, clubId: sub.clubId, status: { in: ['TODO', 'IN_PROGRESS'] } },
        take: 5,
      }),
    ])

    const upcomingEvents = await db.event.findMany({
      where: { clubId: sub.clubId, startTime: { gte: now }, status: 'SCHEDULED' },
      orderBy: { startTime: 'asc' },
      take: 5,
    })

    // Skip if there's nothing to report
    if (events.length === 0 && announcements.length === 0 && upcomingEvents.length === 0) continue

    const presentCount = attendances.filter(a => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
    const attendanceRate = attendances.length > 0 ? Math.round((presentCount / attendances.length) * 100) : 100

    const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#222">
      <h2 style="color:${sub.club.primaryColor}">${sub.club.name} — Weekly Digest</h2>
      <p style="color:#666">${now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

      <table style="width:100%;margin:20px 0;border-collapse:collapse">
        <tr>
          <td style="background:#f5f5f5;padding:12px;border-radius:6px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:${sub.club.primaryColor}">${attendanceRate}%</div>
            <div style="font-size:11px;color:#999;text-transform:uppercase">Your Attendance</div>
          </td>
          <td style="background:#f5f5f5;padding:12px;border-radius:6px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:${sub.club.primaryColor}">${events.length}</div>
            <div style="font-size:11px;color:#999;text-transform:uppercase">Past Week Events</div>
          </td>
          <td style="background:#f5f5f5;padding:12px;border-radius:6px;text-align:center">
            <div style="font-size:24px;font-weight:bold;color:${sub.club.primaryColor}">${upcomingEvents.length}</div>
            <div style="font-size:11px;color:#999;text-transform:uppercase">Upcoming</div>
          </td>
        </tr>
      </table>

      ${upcomingEvents.length > 0 ? `<h3>📌 Upcoming Events</h3><ul>${upcomingEvents.map(e => `<li><strong>${e.title}</strong> — ${new Date(e.startTime).toLocaleString()}</li>`).join('')}</ul>` : ''}

      ${announcements.length > 0 ? `<h3>📢 Recent Announcements</h3><ul>${announcements.map(a => `<li><strong>${a.title}</strong> — ${a.content.slice(0, 100)}…</li>`).join('')}</ul>` : ''}

      ${tasks.length > 0 ? `<h3>✅ Your Open Tasks</h3><ul>${tasks.map(t => `<li><strong>${t.title}</strong> — due ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'whenever'}</li>`).join('')}</ul>` : ''}

      ${events.length > 0 ? `<h3>📅 Events from the Past Week</h3><ul>${events.map(e => `<li><strong>${e.title}</strong> — ${new Date(e.startTime).toLocaleString()}</li>`).join('')}</ul>` : ''}

      <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
      <p style="color:#999;font-size:12px">You're receiving this because you subscribed to a ${sub.frequency.toLowerCase()} digest for ${sub.club.name}. Manage your subscriptions in Settings.</p>
    </div>`

    await enqueueEmail({
      toEmail: sub.user.email,
      toName: sub.user.name,
      subject: `${sub.club.name} — Weekly Digest`,
      body: html,
      clubId: sub.clubId,
      mergeData: {
        name: sub.user.name,
        club_name: sub.club.name,
        attendance_rate: attendanceRate,
        event_count: events.length,
        upcoming_count: upcomingEvents.length,
      },
    })

    await db.digestSubscription.update({
      where: { id: sub.id },
      data: { lastSentAt: now },
    })
    sent++
  }

  return NextResponse.json({ sent, totalSubs: subs.length })
}
