import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params
  const club = await db.club.findUnique({ where: { id: clubId }, include: { settings: true } })
  if (!club) return new NextResponse('Not found', { status: 404 })

  const user = await getCurrentUser()
  const hasSessionAccess = user && hasPermission(user, 'club:read', clubId)
  if (!hasSessionAccess && !club.isPublic) return new NextResponse('Forbidden', { status: 403 })

  const authorized = Boolean(hasSessionAccess)
  const events = await db.event.findMany({
    where: { clubId, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] } },
    orderBy: { startTime: 'asc' },
  })

  const tz = club.settings?.timezone || 'America/New_York'

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    `PRODID:-//Roster//${escapeICS(club.name)}//EN`,
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(club.name)} Events`,
    `X-WR-TIMEZONE:${tz}`,
    ...events.flatMap(e => {
      const lines = [
        'BEGIN:VEVENT',
        `UID:${e.id}@roster`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(new Date(e.startTime))}`,
        `DTEND:${formatICSDate(new Date(e.endTime))}`,
        `SUMMARY:${escapeICS(e.title)}`,
      ]
      if (authorized) {
        if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`)
        if (e.meetingLink) lines.push(`URL:${escapeICS(e.meetingLink)}`)
      }
      if (e.location) lines.push(`LOCATION:${escapeICS(e.location)}`)
      lines.push(`CATEGORIES:${escapeICS(e.type)}`, 'END:VEVENT')
      return lines
    }),
    'END:VCALENDAR',
  ].join('\r\n')

  const safeName = club.name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'calendar'
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.ics"`,
      'Cache-Control': 'no-cache',
    },
  })
}

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
function escapeICS(s: string): string {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}
