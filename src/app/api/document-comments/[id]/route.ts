import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/** PATCH /api/document-comments/[id] — resolve/unresolve a comment */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
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
  await db.documentComment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
