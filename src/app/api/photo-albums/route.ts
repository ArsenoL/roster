import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/**
 * GET /api/photo-albums?clubId=...&eventId=...
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'photos')
  if (__gate instanceof NextResponse) return __gate

  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const eventId = url.searchParams.get('eventId')

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
  if (eventId) where.eventId = eventId

  const albums = await db.photoAlbum.findMany({
    where,
    include: {
      _count: { select: { photos: true } },
      event: { select: { id: true, title: true, startTime: true } },
      photos: {
        orderBy: { uploadedAt: 'desc' },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ albums })
}

/**
 * POST /api/photo-albums
 * Body: { clubId, eventId?, title, description?, isPublic? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'photos')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json()
  const { clubId, eventId, title, description, isPublic } = body
  if (!clubId || !title) {
    return NextResponse.json({ error: 'clubId and title required' }, { status: 400 })
  }
  if (!hasPermission(user, 'club:write', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const album = await db.photoAlbum.create({
    data: {
      clubId,
      eventId: eventId || null,
      title,
      description: description || null,
      isPublic: isPublic || false,
      uploadedById: user.id,  // always the signed-in user
    },
  })

  return NextResponse.json({ album })
}
