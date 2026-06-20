import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const status = url.searchParams.get('status')

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (status) where.status = status

  const forms = await db.form.findMany({
    where,
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ forms })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { fields, ...formData } = body

  const form = await db.form.create({
    data: {
      ...formData,
      deadline: formData.deadline ? new Date(formData.deadline) : null,
      fields: fields?.length ? {
        create: fields.map((f: any, i: number) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          options: f.options ? JSON.stringify(f.options) : null,
          required: f.required || false,
          defaultValue: f.defaultValue || null,
          description: f.description || null,
          sortOrder: i,
          isVisible: true,
          isEditable: true,
          appliesTo: 'form',
        })),
      } : undefined,
    },
    include: { fields: true },
  })

  await db.auditLog.create({
    data: {
      action: 'create',
      entity: 'Form',
      entityId: form.id,
      clubId: form.clubId,
      after: JSON.stringify(form),
    },
  })

  return NextResponse.json(form)
}
