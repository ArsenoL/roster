import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/public/[slug] — public club portal data
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const club = await db.club.findUnique({
    where: { slug },
    include: {
      // Don't leak the advisor's email to anonymous public-portal viewers —
      // only expose their name. Internal/authenticated routes can include
      // email if needed.
      advisor: { select: { name: true } },
      president: { select: { name: true } },
      _count: { select: { members: true, events: true } },
      settings: true,
    },
  })

  if (!club || !club.isPublic) {
    return NextResponse.json({ error: 'Club not found or not public' }, { status: 404 })
  }

  // Upcoming public events
  const upcomingEvents = await db.event.findMany({
    where: {
      clubId: club.id,
      startTime: { gte: new Date() },
      status: 'SCHEDULED',
    },
    orderBy: { startTime: 'asc' },
    take: 5,
    select: { id: true, title: true, startTime: true, endTime: true, location: true, type: true, description: true },
  })

  // Recent announcements (public-facing)
  const recentNews = await db.announcement.findMany({
    where: { clubId: club.id, isPinned: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, title: true, content: true, createdAt: true },
  })

  return NextResponse.json({
    club: {
      id: club.id,
      name: club.name,
      description: club.description,
      mission: club.mission,
      category: club.category,
      logo: club.logo,
      coverImage: club.coverImage,
      primaryColor: club.primaryColor,
      accentColor: club.accentColor,
      presidentName: club.president?.name,
      advisorName: club.advisor?.name,
      meetingRoom: club.meetingRoom,
      defaultDay: club.defaultDay,
      defaultTime: club.defaultTime,
      dues: club.dues,
      duesCurrency: club.duesCurrency,
      foundedYear: club.foundedYear,
      memberCount: club._count.members,
      eventCount: club._count.events,
      requireApproval: club.requireApproval,
    },
    upcomingEvents,
    recentNews,
    applicationsEnabled: club.settings?.enableApplications || false,
  })
}
