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
  // Cap import size so a caller can't fan out 100k writes in one request.
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Too many rows (max 500 per import)' }, { status: 400 })
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
    // Wrap each entity-type batch in its own transaction so a failure
    // rolls back the partial batch (no half-imported rosters / events / etc).
    await db.$transaction(async (tx) => {
      for (let idx = 0; idx < rows.length; idx++) {
        const m = rows[idx]
        try {
          // Skip rows missing email — synthesizing fake emails (the previous
          // behavior) pollutes the user table with @import.local garbage
          // and makes email delivery impossible for those rows.
          if (!m.email) {
            errors++
            results.push({ name: m.name, status: 'error', error: `Row ${idx} skipped: missing email` })
            continue
          }
          let u = await tx.user.findUnique({ where: { email: m.email } })
          if (!u) {
            u = await tx.user.create({
              data: {
                email: m.email,
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
          const existingMem = await tx.membership.findUnique({
            where: { userId_clubId: { userId: u.id, clubId } }
          })
          if (existingMem) {
            existing++
            results.push({ name: m.name, status: 'existing' })
            continue
          }
          await tx.membership.create({
            data: { userId: u.id, clubId, role: m.role || 'MEMBER' }
          })
          created++
          results.push({ name: m.name, status: 'created' })
        } catch (e: any) {
          errors++
          results.push({ name: m.name, status: 'error', error: `Row ${idx} failed` })
        }
      }
    })
  } else if (type === 'events') {
    await db.$transaction(async (tx) => {
      for (let idx = 0; idx < rows.length; idx++) {
        const e = rows[idx]
        try {
          if (!e.title || !e.startTime) {
            errors++
            results.push({ title: e.title, status: 'error', error: 'title and startTime required' })
            continue
          }
          const event = await tx.event.create({
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
          results.push({ title: e.title, status: 'error', error: `Row ${idx} failed` })
        }
      }
    })
  } else if (type === 'transactions') {
    await db.$transaction(async (tx) => {
      for (let idx = 0; idx < rows.length; idx++) {
        const t = rows[idx]
        try {
          if (!t.amount || !t.type) {
            errors++
            results.push({ description: t.description, status: 'error', error: 'amount and type required' })
            continue
          }
          await tx.transaction.create({
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
          results.push({ description: t.description, status: 'error', error: `Row ${idx} failed` })
        }
      }
    })
  } else if (type === 'inventory') {
    await db.$transaction(async (tx) => {
      for (let idx = 0; idx < rows.length; idx++) {
        const i = rows[idx]
        try {
          if (!i.name) {
            errors++
            results.push({ name: i.name, status: 'error', error: 'name required' })
            continue
          }
          await tx.inventoryItem.create({
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
          results.push({ name: i.name, status: 'error', error: `Row ${idx} failed` })
        }
      }
    })
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

  // Fire webhook — 'form.submitted' is already in the WebhookEvent union,
  // so no `as any` cast is needed.
  emitWebhook(clubId, 'form.submitted', {
    type: 'bulk_import', entity: type, created, existing, errors,
  }).catch(() => {})

  return NextResponse.json({ type, created, existing, errors, total: rows.length, results })
}
