import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shapeAuthUser, validateEmail } from '@/lib/clubhub/auth'
import { createServerClient } from '@/lib/supabase-server'

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Pure Supabase Auth — no legacy fallback.
 */
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')

  const emailErr = validateEmail(email)
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 })
  if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 })

  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  // Find the User row by supabaseAuthId
  let user = await db.user.findFirst({
    where: { supabaseAuthId: data.user.id },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { club: { select: { id: true, name: true } } },
      },
    },
  })

  // If not found by supabaseAuthId, try email (migrated user)
  if (!user && data.user.email) {
    user = await db.user.findUnique({
      where: { email: data.user.email },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { club: { select: { id: true, name: true } } },
        },
      },
    })
    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: { supabaseAuthId: data.user.id },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { club: { select: { id: true, name: true } } },
          },
        },
      })
    }
  }

  // If still not found, create
  if (!user) {
    const name = data.user.user_metadata?.name || email.split('@')[0]
    user = await db.user.create({
      data: { email, name, role: 'STUDENT', supabaseAuthId: data.user.id },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { club: { select: { id: true, name: true } } },
        },
      },
    })
  }

  return NextResponse.json({ ok: true, user: shapeAuthUser(user) })
}
