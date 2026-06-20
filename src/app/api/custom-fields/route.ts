import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/custom-fields?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const where: any = {}
  if (clubId) where.clubId = clubId
  const fields = await db.customField.findMany({
    where,
    orderBy: { sortOrder: 'asc' }
  })
  return NextResponse.json({ fields })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const field = await db.customField.create({
    data: {
      clubId: body.clubId,
      name: body.name,
      label: body.label,
      type: body.type,
      options: body.options ? JSON.stringify(body.options) : null,
      required: body.required || false,
      defaultValue: body.defaultValue || null,
      description: body.description || null,
      sortOrder: body.sortOrder || 0,
      isVisible: body.isVisible ?? true,
      isEditable: body.isEditable ?? true,
      appliesTo: body.appliesTo || 'member',
    }
  })
  await db.auditLog.create({
    data: { action: 'create', entity: 'CustomField', entityId: field.id, clubId: body.clubId, after: JSON.stringify(field) }
  })
  return NextResponse.json({ field })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body
  const field = await db.customField.update({
    where: { id },
    data: {
      ...updates,
      options: updates.options ? JSON.stringify(updates.options) : undefined,
    }
  })
  return NextResponse.json({ field })
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await db.customField.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
