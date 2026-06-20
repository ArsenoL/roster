import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/export?type=members|attendance|events&clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'members'
  const clubId = url.searchParams.get('clubId')

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
      }
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
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
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
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
    }
  } else if (type === 'events') {
    const where: any = {}
    if (clubId && clubId !== 'ALL') where.clubId = clubId
    const events = await db.event.findMany({
      where,
      include: { club: { select: { name: true } }, _count: { select: { attendances: true } } },
      orderBy: { startTime: 'desc' }
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
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n'
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    }
  })
}
