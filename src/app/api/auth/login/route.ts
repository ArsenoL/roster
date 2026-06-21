import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateSessionToken,
  setSessionCookie,
  validateEmail,
  verifyPassword,
} from '@/lib/clubhub/auth'

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
  // — if the user doesn't exist, verify against a dummy hash so the cost
  // of a missing-user request matches the cost of a bad-password request.
  const DUMMY_HASH =
    'scrypt$00000000000000000000000000000000$' +
    '00'.repeat(64)
  const ok = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_HASH
  )

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

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })
  await setSessionCookie(res, sessionToken)
  return res
}
