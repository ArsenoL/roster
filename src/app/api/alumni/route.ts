import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'

export async function GET(req: NextRequest) {
  const __gate = await verifyModule(req, 'alumni')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId

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
  const __gate = await verifyModule(req, 'alumni')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const a = await db.alumniProfile.create({
    data: {
      userId: body.userId,
      clubId: body.clubId || null,
      graduationYear: body.graduationYear,
      college: body.college || null,
      major: body.major || null,
      career: body.career || null,
      employer: body.employer || null,
      location: body.location || null,
      linkedin: body.linkedin || null,
      mentorshipAvailable: body.mentorshipAvailable || false,
      mentorshipAreas: body.mentorshipAreas ? JSON.stringify(body.mentorshipAreas) : null,
      willingToDonate: body.willingToDonate || false,
      willingToSpeak: body.willingToSpeak || false,
      newsletter: body.newsletter ?? true,
      notes: body.notes || null,
    },
  })
  return NextResponse.json(a)
}
