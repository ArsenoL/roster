import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shapeAuthUser, validateEmail } from '@/lib/clubhub/auth'
import { createServerClient } from '@/lib/supabase'

// Per-IP rate limiter — 20 login attempts per 15 minutes.
const loginAttempts = new Map<string, { count: number; firstAt: number }>()
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 20

function checkLoginRate(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now })
    return true
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) return false
  entry.count++
  return true
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of loginAttempts) {
      if (now - entry.firstAt > LOGIN_WINDOW_MS) loginAttempts.delete(ip)
    }
  }, 10 * 60 * 1000).unref?.()
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Uses Supabase Auth for authentication. After successful sign-in, looks up
 * the corresponding User row in our public.User table by supabaseAuthId.
 * If the user doesn't have a User row yet (e.g., legacy user being migrated),
 * creates one automatically.
 *
 * The Supabase SSR client automatically sets the auth cookies on the response.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkLoginRate(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')

  const emailErr = validateEmail(email)
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 })
  if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 })

  // Sign in via Supabase Auth
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json(
      { error: 'Incorrect email or password' },
      { status: 401 }
    )
  }

  // Look up or create the User row in our public.User table
  let user = await db.user.findFirst({
    where: { supabaseAuthId: data.user.id },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { club: { select: { id: true, name: true } } },
      },
    },
  })

  if (!user) {
    // Legacy user — they exist in auth.users but not in public.User.
    // Try to find them by email, and link their supabaseAuthId.
    user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { club: { select: { id: true, name: true } } },
        },
      },
    })

    if (user) {
      // Link the Supabase auth ID to the existing User row
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
    } else {
      // Brand new user — create a User row
      const name = data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User'
      user = await db.user.create({
        data: {
          email,
          name,
          role: 'STUDENT',
          supabaseAuthId: data.user.id,
        },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { club: { select: { id: true, name: true } } },
          },
        },
      })
    }
  }

  const fullUser = shapeAuthUser(user)
  return NextResponse.json({ ok: true, user: fullUser })
}
