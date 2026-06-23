import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateSessionToken,
  hashPassword,
  setSessionCookie,
  shapeAuthUser,
  validateEmail,
  verifyPassword,
} from '@/lib/clubhub/auth'

// Per-IP rate limiter — 20 login attempts per 15 minutes.
// Prevents brute-force password guessing from a single source IP.
const loginAttempts = new Map<string, { count: number; firstAt: number }>()
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 20

function checkLoginRate(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || (now - entry.firstAt) > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now })
    return true
  }
  entry.count += 1
  if (entry.count > LOGIN_MAX_ATTEMPTS) return false
  return true
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Verifies the email + password and starts a new session.
 *
 * Security notes:
 *  - We always run verifyPassword (even on missing user) to keep response
 *    timing roughly constant — slightly weakens user enumeration but is
 *    better UX than a generic "invalid credentials" with no hint.
 *  - Returns 401 with a generic message on any failure (bad email, bad
 *    password, no password set on the account — e.g. invited users).
 *  - On success, rotates the session token: any existing sessions stay
 *    alive (multi-device login), we just add a new one.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkLoginRate(ip)) {
    return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 })
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
  if (emailErr) {
    return NextResponse.json({ error: emailErr }, { status: 400 })
  }
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })

  // Always run verifyPassword with something to keep timing roughly constant
  // — if the user doesn't exist, hash this request's password and verify
  // against that freshly-computed hash so the per-request work matches the
  // real-login path (a static DUMMY_HASH is unsafe — verifyPassword returns
  // false fast for hashes whose keylen != SCRYPT_KEYLEN).
  let ok = false
  if (user?.passwordHash) {
    ok = await verifyPassword(password, user.passwordHash)
  } else {
    const dummyHash = await hashPassword(password)
    await verifyPassword(password, dummyHash) // run for timing cost
    ok = false
  }

  if (!user || !ok) {
    return NextResponse.json(
      { error: 'Incorrect email or password' },
      { status: 401 }
    )
  }

  // Create a fresh session
  const sessionToken = await generateSessionToken(user.id)
  await db.userSession.create({
    data: {
      userId: user.id,
      token: sessionToken,
      ipAddress: req.headers.get('x-forwarded-for') || null,
      userAgent: req.headers.get('user-agent') || null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  })

  // Fetch the user's active memberships so the client can compute the
  // correct landing page without an extra round-trip. Without memberships,
  // defaultLandingForUser() would send every non-STUDENT/non-PARENT user
  // to /app/onboarding even if they have an active club.
  //
  // (We can't use getCurrentUser() here because it reads the session cookie
  // from the incoming request — and we haven't set the response cookie yet.)
  const userWithMemberships = await db.user.findUnique({
    where: { id: user.id },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { club: { select: { id: true, name: true } } },
      },
    },
  })

  const fullUser = shapeAuthUser(userWithMemberships!)

  const res = NextResponse.json({ ok: true, user: fullUser })
  await setSessionCookie(res, sessionToken)
  return res
}
