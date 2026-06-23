import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { csvSafe, csvField } from '@/lib/clubhub/sanitize'

// GET /api/export?type=members|attendance|events&clubId=...
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'members'
  const clubId = url.searchParams.get('clubId')

  // Exporting CSV is sensitive (PII: emails, phone numbers, student IDs).
  // Require club:read on the target club. If no clubId is given, non-admins
  // get an explicit error (we don't silently scope — the export endpoint
  // expects a club context).
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'clubId required' }, { status: 400 })
  }

  // Reject unknown export types instead of silently returning an empty CSV.
  if (!['members', 'attendance', 'events'].includes(type)) {
    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
  }

  let csv = ''
  let filename = `${type}_export_${new Date().toISOString().slice(0, 10)}.csv`

  if (type === 'members') {
    const where: any = { status: 'ACTIVE' }
    if (clubId && clubId !== 'ALL') where.clubId = clubId
    const memberships = await db.membership.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, studentId: true, grade: true, graduationYear: true, house: true, phone: true, pronouns: true } },
        club: { select: { name: true } },
      },
      take: 5000,
    })
    csv = 'Name,Email,StudentID,Grade,GradYear,House,Pronouns,Phone,Club,Role,Points,Streak,Joined\n'
    for (const m of memberships) {
      csv += [
        m.user.name,
        m.user.email,
        m.user.studentId || '',
        m.user.grade || '',
        m.user.graduationYear || '',
        m.user.house || '',
        m.user.pronouns || '',
        m.user.phone || '',
        m.club.name,
        m.role,
        m.points,
        m.streak,
        m.joinedAt.toISOString().slice(0, 10),
      ].map(v => csvField(csvSafe(v))).join(',') + '\n'
    }
  } else if (type === 'attendance') {
    const where: any = {}
    if (clubId && clubId !== 'ALL') where.event = { clubId }
    const records = await db.attendance.findMany({
      where,
      include: {
        user: { select: { name: true, studentId: true, email: true } },
        event: { select: { title: true, startTime: true, club: { select: { name: true } } } },
      },
      orderBy: { event: { startTime: 'desc' } },
      take: 5000,
    })
    csv = 'Club,Event,EventDate,StudentName,StudentID,Email,Status,Method,CheckIn,CheckOut,Points\n'
    for (const r of records) {
      csv += [
        r.event.club.name,
        r.event.title,
        r.event.startTime.toISOString(),
        r.user.name,
        r.user.studentId || '',
        r.user.email,
        r.status,
        r.method || '',
        r.checkInTime?.toISOString() || '',
        r.checkOutTime?.toISOString() || '',
        r.pointsEarned,
      ].map(v => csvField(csvSafe(v))).join(',') + '\n'
    }
  } else if (type === 'events') {
    const where: any = {}
    if (clubId && clubId !== 'ALL') where.clubId = clubId
    const events = await db.event.findMany({
      where,
      include: { club: { select: { name: true } }, _count: { select: { attendances: true } } },
      orderBy: { startTime: 'desc' },
      take: 5000,
    })
    csv = 'Club,Title,Type,Start,End,Location,Capacity,Required,Status,Attendance\n'
    for (const e of events) {
      csv += [
        e.club.name,
        e.title,
        e.type,
        e.startTime.toISOString(),
        e.endTime.toISOString(),
        e.location || '',
        e.capacity || '',
        e.isRequired ? 'Yes' : 'No',
        e.status,
        e._count.attendances,
      ].map(v => csvField(csvSafe(v))).join(',') + '\n'
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    }
  })
}
