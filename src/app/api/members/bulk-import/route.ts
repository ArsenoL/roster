import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

// POST /api/members/bulk-import
// Body: { clubId, members: [{ name, email, studentId, grade, ... }] }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { clubId, members } = body as { clubId: string, members: any[] }
  if (!clubId || !Array.isArray(members)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  // Bulk-adding members requires members:write on the target club.
  if (!hasPermission(user, 'members:write', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: any[] = []
  let created = 0, existing = 0, errors = 0

  for (const m of members) {
    try {
      let u = m.email ? await db.user.findUnique({ where: { email: m.email } }) : null
      if (!u) {
        u = await db.user.create({
          data: {
            email: m.email || `unknown_${Date.now()}_${Math.random().toString(36).slice(2)}@import.local`,
            name: m.name || 'Unknown',
            role: 'STUDENT',
            studentId: m.studentId || null,
            grade: m.grade ? parseInt(m.grade) : null,
            graduationYear: m.graduationYear ? parseInt(m.graduationYear) : null,
            house: m.house || null,
            phone: m.phone || null,
          }
        })
      }
      const existingMem = await db.membership.findUnique({
        where: { userId_clubId: { userId: u.id, clubId } }
      })
      if (existingMem) {
        existing++
        results.push({ name: m.name, status: 'existing' })
        continue
      }
      await db.membership.create({
        data: { userId: u.id, clubId, role: m.role || 'MEMBER' }
      })
      created++
      results.push({ name: m.name, status: 'created' })
    } catch (e: any) {
      errors++
      results.push({ name: m.name, status: 'error', error: e.message })
    }
  }

  await db.auditLog.create({
    data: {
      action: 'bulk_import',
      entity: 'Membership',
      clubId,
      userId: user.id,
      after: JSON.stringify({ created, existing, errors, total: members.length })
    }
  })

  return NextResponse.json({ created, existing, errors, total: members.length, results })
}
