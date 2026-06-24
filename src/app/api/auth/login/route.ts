import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  shapeAuthUser,
  validateEmail,
  verifyPassword,
  generateSessionToken,
  setSessionCookie,
} from '@/lib/clubhub/auth'
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
 * Tries Supabase Auth first. If that fails (e.g., user has a .local email
 * that Supabase rejects, or the user hasn't been migrated to Supabase Auth
 * yet), falls back to the legacy scrypt password verification.
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

  // --- Path 1: Try Supabase Auth ---
  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error && data.user) {
      // Supabase auth succeeded — look up or create the User row
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
        // Legacy user — find by email and link supabaseAuthId
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
          // Brand new user
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
      }

      return NextResponse.json({ ok: true, user: shapeAuthUser(user) })
    }
  } catch (e) {
    // Supabase error — fall through to legacy auth
  }

  // --- Path 2: Legacy auth (for users not in Supabase Auth) ---
  // Look up the user by email and verify their scrypt password hash.
  const legacyUser = await db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { club: { select: { id: true, name: true } } },
      },
    },
  })

  if (legacyUser?.passwordHash) {
    const ok = await verifyPassword(password, legacyUser.passwordHash)
    if (ok) {
      // Legacy login succeeded — set the legacy session cookie.
      // The Supabase cookie won't be set, but getCurrentUser() checks
      // both paths so the user stays authenticated.
      const sessionToken = await generateSessionToken(legacyUser.id)
      await db.userSession.create({
        data: {
          userId: legacyUser.id,
          token: sessionToken,
          ipAddress: req.headers.get('x-forwarded-for') || null,
          userAgent: req.headers.get('user-agent') || null,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        },
      })
      const res = NextResponse.json({ ok: true, user: shapeAuthUser(legacyUser) })
      await setSessionCookie(res, sessionToken)
      return res
    }
  }

  // Both paths failed
  return NextResponse.json(
    { error: 'Incorrect email or password' },
    { status: 401 }
  )
}
