import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/photo-albums/[id]/photos
 * Body: { url, caption?, width?, height?, uploadedById? }
 *       OR { urls: [...], uploadedById? } to bulk-add multiple URLs
 *
 * Note: this route accepts URLs (e.g. uploaded to /upload or external CDN).
 * It does not handle multipart form data directly — clients upload the binary
 * first via /api/upload (or external) then add the resulting URL here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params
  const body = await req.json()

  const album = await db.photoAlbum.findUnique({ where: { id: albumId } })
  if (!album) return NextResponse.json({ error: 'Album not found' }, { status: 404 })

  const urls: string[] = Array.isArray(body.urls) ? body.urls : body.url ? [body.url] : []
  if (urls.length === 0) {
    return NextResponse.json({ error: 'url or urls required' }, { status: 400 })
  }

  const created = await db.$transaction(
    urls.map((url, i) =>
      db.photo.create({
        data: {
          albumId,
          url,
          caption: Array.isArray(body.captions) ? body.captions[i] : body.caption || null,
          width: body.width || null,
          height: body.height || null,
          uploadedById: body.uploadedById || null,
        },
      })
    )
  )

  // Set cover photo to first upload if none set
  if (!album.coverPhoto && created.length > 0) {
    await db.photoAlbum.update({
      where: { id: albumId },
      data: { coverPhoto: created[0].url },
    })
  }

  return NextResponse.json({ added: created.length, photos: created })
}

/** GET /api/photo-albums/[id]/photos — list all photos in album */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params
  const photos = await db.photo.findMany({
    where: { albumId },
    orderBy: { uploadedAt: 'desc' },
  })
  return NextResponse.json({ photos })
}

/** DELETE /api/photo-albums/[id]/photos?id=<photoId> — remove a single photo */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: albumId } = await params
  const url = new URL(req.url)
  const photoId = url.searchParams.get('id')
  if (!photoId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await db.photo.delete({ where: { id: photoId } })
  return NextResponse.json({ ok: true })
}
