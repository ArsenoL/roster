import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/calendar/[clubId].ics — iCal feed for a club
export async function GET(req: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params

  const club = await db.club.findUnique({ where: { id: clubId } })
  if (!club) return new NextResponse('Not found', { status: 404 })

  const events = await db.event.findMany({
    where: { clubId, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] } },
    orderBy: { startTime: 'asc' },
  })

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Roster//${club.name}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${club.name} Events`,
    `X-WR-TIMEZONE:America/New_York`,
    ...events.flatMap(e => [
      'BEGIN:VEVENT',
      `UID:${e.id}@roster`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(new Date(e.startTime))}`,
      `DTEND:${formatICSDate(new Date(e.endTime))}`,
      `SUMMARY:${escapeICS(e.title)}`,
      e.description ? `DESCRIPTION:${escapeICS(e.description)}` : '',
      e.location ? `LOCATION:${escapeICS(e.location)}` : '',
      e.meetingLink ? `URL:${e.meetingLink}` : '',
      `CATEGORIES:${e.type}`,
      'END:VEVENT',
    ]).filter(Boolean),
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${club.name.replace(/\s+/g, '-').toLowerCase()}.ics"`,
      'Cache-Control': 'no-cache',
    },
  })
}

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}
