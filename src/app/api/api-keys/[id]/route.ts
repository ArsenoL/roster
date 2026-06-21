import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Look up the key first so we can check club-scoped permission.
  const key = await db.apiKey.findUnique({ where: { id }, select: { clubId: true } })
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (key.clubId && !hasPermission(user, 'club:write', key.clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Tenant-wide keys (no clubId) can only be deleted by tenant admins.
  if (!key.clubId && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.apiKey.delete({ where: { id } })
  await db.auditLog.create({
    data: { action: 'delete', entity: 'ApiKey', entityId: id, clubId: key.clubId, userId: user.id }
  })
  return NextResponse.json({ ok: true })
}
