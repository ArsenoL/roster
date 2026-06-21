import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook } from '@/lib/clubhub/dispatchers'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/**
 * POST /api/bulk-import
 * Body: { clubId, type: 'members' | 'events' | 'transactions' | 'inventory', rows: [...] }
 * Imports multiple rows for the given entity type.
 *
 * Requires members:write / events:write / finance:write / club:write on the
 * target club, depending on the type. The signed-in user is recorded as the
 * creator/recordedBy for imported rows.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { clubId, type, rows } = body
  if (!clubId || !type || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'clubId, type, rows[] required' }, { status: 400 })
  }

  // Determine required permission based on type
  const permMap: Record<string, string> = {
    members: 'members:write',
    events: 'events:write',
    transactions: 'finance:write',
    inventory: 'club:write',
  }
  const requiredPerm = permMap[type]
  if (!requiredPerm) {
    return NextResponse.json({ error: 'Unsupported type. Use members | events | transactions | inventory' }, { status: 400 })
  }
  if (!hasPermission(user, requiredPerm, clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let created = 0, existing = 0, errors = 0
  const results: any[] = []

  if (type === 'members') {
    for (const m of rows) {
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
  } else if (type === 'events') {
    for (const e of rows) {
      try {
        if (!e.title || !e.startTime) {
          errors++
          results.push({ title: e.title, status: 'error', error: 'title and startTime required' })
          continue
        }
        const event = await db.event.create({
          data: {
            clubId,
            title: e.title,
            type: (e.type || 'MEETING').toUpperCase(),
            startTime: new Date(e.startTime),
            endTime: e.endTime ? new Date(e.endTime) : new Date(new Date(e.startTime).getTime() + 60 * 60 * 1000),
            location: e.location || null,
            capacity: e.capacity ? parseInt(e.capacity) : null,
            isRequired: e.isRequired === true || e.isRequired === 'true',
            status: 'SCHEDULED',
            description: e.description || null,
          }
        })
        created++
        results.push({ title: e.title, status: 'created', id: event.id })
      } catch (e: any) {
        errors++
        results.push({ title: e.title, status: 'error', error: e.message })
      }
    }
  } else if (type === 'transactions') {
    for (const t of rows) {
      try {
        if (!t.amount || !t.type) {
          errors++
          results.push({ description: t.description, status: 'error', error: 'amount and type required' })
          continue
        }
        await db.transaction.create({
          data: {
            clubId,
            amount: parseFloat(t.amount),
            type: t.type.toUpperCase(),
            category: t.category || 'OTHER',
            description: t.description || null,
            date: t.date ? new Date(t.date) : new Date(),
            recordedById: user.id,  // always the signed-in user
          }
        })
        created++
        results.push({ description: t.description, status: 'created' })
      } catch (e: any) {
        errors++
        results.push({ description: t.description, status: 'error', error: e.message })
      }
    }
  } else if (type === 'inventory') {
    for (const i of rows) {
      try {
        if (!i.name) {
          errors++
          results.push({ name: i.name, status: 'error', error: 'name required' })
          continue
        }
        await db.inventoryItem.create({
          data: {
            clubId,
            name: i.name,
            description: i.description || null,
            category: i.category || 'equipment',
            sku: i.sku || null,
            serialNumber: i.serialNumber || null,
            quantity: i.quantity ? parseInt(i.quantity) : 1,
            quantityAvailable: i.quantity ? parseInt(i.quantity) : 1,
            condition: (i.condition || 'NEW').toUpperCase(),
            purchasePrice: i.purchasePrice ? parseFloat(i.purchasePrice) : null,
            location: i.location || null,
          }
        })
        created++
        results.push({ name: i.name, status: 'created' })
      } catch (e: any) {
        errors++
        results.push({ name: i.name, status: 'error', error: e.message })
      }
    }
  }

  await db.auditLog.create({
    data: {
      action: 'bulk_import',
      entity: type,
      clubId,
      userId: user.id,
      after: JSON.stringify({ created, existing, errors, total: rows.length })
    }
  })

  // Fire webhook
  emitWebhook(clubId, 'form.submitted' as any, {
    type: 'bulk_import', entity: type, created, existing, errors,
  }).catch(() => {})

  return NextResponse.json({ type, created, existing, errors, total: rows.length, results })
}
