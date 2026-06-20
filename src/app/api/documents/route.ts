import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const category = url.searchParams.get('category')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (category) where.category = category

  const docs = await db.document.findMany({
    where,
    include: {
      uploadedBy: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ documents: docs })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const doc = await db.document.create({
    data: {
      clubId: body.clubId,
      title: body.title,
      description: body.description || null,
      category: body.category || 'other',
      fileUrl: body.fileUrl || null,
      fileType: body.fileType || null,
      fileSize: body.fileSize || null,
      uploadedById: body.uploadedById || null,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      isPublic: body.isPublic || false,
    },
  })

  return NextResponse.json(doc)
}
