import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail, mergeTemplate } from '@/lib/clubhub/dispatchers'

// GET /api/email/templates?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  const templates = await db.emailTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ templates })
}

// POST /api/email/templates — create or save a template
export async function POST(req: NextRequest) {
  const body = await req.json()
  const tpl = await db.emailTemplate.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      subject: body.subject,
      body: body.body,
      type: body.type || 'custom',
    },
  })
  return NextResponse.json({ template: tpl })
}
