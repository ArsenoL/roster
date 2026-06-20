import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/document-comments?documentId=...
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const documentId = url.searchParams.get('documentId')
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

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
 * Body: { documentId, userId, body, anchor? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { documentId, userId, body: commentBody, anchor } = body
  if (!documentId || !userId || !commentBody) {
    return NextResponse.json({ error: 'documentId, userId, body required' }, { status: 400 })
  }

  const comment = await db.documentComment.create({
    data: {
      documentId,
      userId,
      body: commentBody,
      anchor: anchor || null,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  })

  return NextResponse.json({ comment })
}
