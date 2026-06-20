import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** GET /api/photo-albums/[id] — fetch album with all photos */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const album = await db.photoAlbum.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { uploadedAt: 'desc' } },
      event: { select: { id: true, title: true, startTime: true } },
      club: { select: { id: true, name: true, primaryColor: true } },
    },
  })
  if (!album) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ album })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  await db.photoAlbum.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
