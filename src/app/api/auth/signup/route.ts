import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shapeAuthUser, validateEmail, validatePassword } from '@/lib/clubhub/auth'
import { createServerClient } from '@/lib/supabase'

// Per-IP rate limiter — 5 signups per hour.
const signupAttempts = new Map<string, { count: number; firstAt: number }>()
const SIGNUP_WINDOW_MS = 60 * 60 * 1000
const SIGNUP_MAX_PER_WINDOW = 5

function checkSignupRate(ip: string): boolean {
  const now = Date.now()
  const entry = signupAttempts.get(ip)
  if (!entry || now - entry.firstAt > SIGNUP_WINDOW_MS) {
    signupAttempts.set(ip, { count: 1, firstAt: now })
    return true
  }
  if (entry.count >= SIGNUP_MAX_PER_WINDOW) return false
  entry.count++
  return true
}

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of signupAttempts) {
      if (now - entry.firstAt > SIGNUP_WINDOW_MS) signupAttempts.delete(ip)
    }
  }, 10 * 60 * 1000).unref?.()
}

/**
 * POST /api/auth/signup
 * Body: { name, email, password }
 *
 * Creates a new user via Supabase Auth, then creates a corresponding
 * User row in our public.User table with the supabaseAuthId link.
 *
 * The Supabase SSR client automatically sets the auth cookies on the response.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkSignupRate(ip)) {
    return NextResponse.json(
      { error: 'Too many signups from this IP. Please try again later.' },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')

  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'Name is required (max 80 characters)' }, { status: 400 })
  }

  const emailErr = validateEmail(email)
  if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 })

  const pwErr = validatePassword(password)
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 })

  // Sign up via Supabase Auth
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }, // stored in user_metadata
    },
  })

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || 'Signup failed' },
      { status: 400 }
    )
  }

  // Create the User row in our public.User table
  const user = await db.user.create({
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

  // If session is null (email confirmation required), the user will need
  // to confirm their email before they can log in. Supabase handles this.
  const fullUser = shapeAuthUser(user)
  return NextResponse.json({ ok: true, user: fullUser }, { status: 201 })
}
