import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/** GET /api/photo-albums/[id] — fetch album with all photos */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const album = await db.photoAlbum.findUnique({
    where: { id },
    include: {
      // Cap photos at 500 — an unbounded relation pull could OOM the
      // process on an album with tens of thousands of photos.
      photos: { orderBy: { uploadedAt: 'desc' }, take: 500 },
      event: { select: { id: true, title: true, startTime: true } },
      club: { select: { id: true, name: true, primaryColor: true } },
    },
  })
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Allow public albums to be viewed without club:read, otherwise require
  // membership in the album's club.
  if (!album.isPublic && !hasPermission(user, 'club:read', album.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ album })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.photoAlbum.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const album = await db.photoAlbum.update({
    where: { id },
    data: {
      ...(body.title != null && { title: body.title }),
      ...(body.description != null && { description: body.description }),
      ...(body.isPublic != null && { isPublic: body.isPublic }),
      ...(body.coverPhoto != null && { coverPhoto: body.coverPhoto }),
    },
  })
  return NextResponse.json({ album })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.photoAlbum.findUnique({ where: { id }, select: { clubId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!hasPermission(user, 'club:write', existing.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.photoAlbum.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
