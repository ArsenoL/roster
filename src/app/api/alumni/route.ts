import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'alumni')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') {
    if (!hasPermission(user, 'club:read', clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    where.clubId = clubId
  } else if (user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    const myClubIds = user.memberships
      .filter(m => hasPermission(user, 'club:read', m.clubId))
      .map(m => m.clubId)
    where.clubId = { in: myClubIds.length > 0 ? myClubIds : ['__none__'] }
  }

  const alumni = await db.alumniProfile.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
      club: { select: { id: true, name: true } },
    },
    orderBy: { graduationYear: 'desc' },
  })

  // Summary
  const summary = {
    total: alumni.length,
    mentors: alumni.filter(a => a.mentorshipAvailable).length,
    donors: alumni.filter(a => a.willingToDonate).length,
    speakers: alumni.filter(a => a.willingToSpeak).length,
    byYear: alumni.reduce((acc, a) => {
      acc[a.graduationYear] = (acc[a.graduationYear] || 0) + 1
      return acc
    }, {} as Record<number, number>),
    byCollege: alumni.reduce((acc, a) => {
      if (a.college) acc[a.college] = (acc[a.college] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }

  return NextResponse.json({ alumni, summary })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'alumni')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  if (body.clubId && !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Two cases:
  //  1. An admin/officer is creating an alumni profile for someone else
  //     (body.userId is set and isn't the signed-in user). Requires club:write.
  //  2. The signed-in user is creating their own alumni profile (no body.userId
  //     or body.userId === user.id). Allowed for any member.
  const targetUserId = body.userId || user.id
  const isSelf = targetUserId === user.id
  if (!isSelf && !hasPermission(user, 'club:write', body.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const a = await db.alumniProfile.create({
    data: {
      userId: targetUserId,
      clubId: body.clubId || null,
      graduationYear: body.graduationYear,
      college: body.college || null,
      major: body.major || null,
      career: body.career || null,
      employer: body.employer || null,
      location: body.location || null,
      linkedin: body.linkedin || null,
      mentorshipAvailable: body.mentorshipAvailable || false,
      mentorshipAreas: body.mentorshipAreas ?? null,
      willingToDonate: body.willingToDonate || false,
      willingToSpeak: body.willingToSpeak || false,
      newsletter: body.newsletter ?? true,
      notes: body.notes || null,
    },
  })
  return NextResponse.json(a)
}
