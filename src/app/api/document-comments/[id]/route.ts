import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/** PATCH /api/document-comments/[id] — resolve/unresolve a comment */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.documentComment.findUnique({
    where: { id },
    include: { document: { select: { clubId: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Resolving/unresolving a comment requires club:write. Editing the body
  // is allowed only for the comment author.
  const body = await req.json()
  const wantsResolve = body.resolved != null
  if (wantsResolve) {
    if (!hasPermission(user, 'club:write', existing.document.clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (body.body != null) {
    if (existing.userId !== user.id && !hasPermission(user, 'club:write', existing.document.clubId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const comment = await db.documentComment.update({
    where: { id },
    data: {
      ...(body.body != null && { body: body.body }),
      ...(body.resolved != null && { resolved: body.resolved }),
    },
  })
  return NextResponse.json({ comment })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.documentComment.findUnique({
    where: { id },
    include: { document: { select: { clubId: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Author can delete their own comment; otherwise require club:write.
  if (existing.userId !== user.id && !hasPermission(user, 'club:write', existing.document.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.documentComment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
