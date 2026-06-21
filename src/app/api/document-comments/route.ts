import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/**
 * GET /api/document-comments?documentId=...
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const documentId = url.searchParams.get('documentId')
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

  // Verify the document's club is readable by the caller.
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { clubId: true } })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', doc.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const comments = await db.documentComment.findMany({
    where: { documentId },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ comments })
}

/**
 * POST /api/document-comments
 * Body: { documentId, body, anchor? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { documentId, body: commentBody, anchor } = body
  if (!documentId || !commentBody) {
    return NextResponse.json({ error: 'documentId and body required' }, { status: 400 })
  }

  // Verify the document's club is readable.
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { clubId: true } })
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!hasPermission(user, 'club:read', doc.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const comment = await db.documentComment.create({
    data: {
      documentId,
      userId: user.id,  // always the signed-in user
      body: commentBody,
      anchor: anchor || null,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  })

  return NextResponse.json({ comment })
}
