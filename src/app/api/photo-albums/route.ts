import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/photo-albums?clubId=...&eventId=...
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const eventId = url.searchParams.get('eventId')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
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
  const body = await req.json()
  const { clubId, eventId, title, description, isPublic } = body
  if (!clubId || !title) {
    return NextResponse.json({ error: 'clubId and title required' }, { status: 400 })
  }

  const album = await db.photoAlbum.create({
    data: {
      clubId,
      eventId: eventId || null,
      title,
      description: description || null,
      isPublic: isPublic || false,
      uploadedById: body.uploadedById || null,
    },
  })

  return NextResponse.json({ album })
}
