import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateSessionToken,
  hashPassword,
  setSessionCookie,
  shapeAuthUser,
  validateEmail,
  validatePassword,
} from '@/lib/clubhub/auth'

/**
 * POST /api/auth/signup
 * Body: { name, email, password }
 *
 * Creates a new user with a hashed password, then immediately starts a
 * session (so the user is signed in after signup — no separate login step).
 *
 * Validation:
 *  - name: 1–80 chars, trimmed
 *  - email: must pass validateEmail() and be unique (case-insensitive)
 *  - password: must pass validatePassword() (≥8 chars, letters + numbers)
 *
 * The new user gets role STUDENT by default (per the User schema). They can
 * be promoted by an admin after they join a club.
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = String(body.name || '').trim()
  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')

  // Validate inputs
  if (!name || name.length > 80) {
    return NextResponse.json(
      { error: 'Name is required (max 80 characters)' },
      { status: 400 }
    )
  }

  const emailErr = validateEmail(email)
  if (emailErr) {
    return NextResponse.json({ error: emailErr }, { status: 400 })
  }

  const pwErr = validatePassword(password)
  if (pwErr) {
    return NextResponse.json({ error: pwErr }, { status: 400 })
  }

  // Check for existing user — race-safe via unique constraint, but this
  // pre-check lets us return a friendly 409 instead of a 500.
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: 'An account with that email already exists. Try logging in instead.' },
      { status: 409 }
    )
  }

  // Hash the password and create the user
  const passwordHash = await hashPassword(password)
  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: 'STUDENT',
    },
  })

  // Start a session
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
  // correct landing page. A freshly-signed-up user has no memberships,
  // so defaultLandingForUser() will send them to /app/onboarding — which
  // is the correct UX (they need to create or join a club first).
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

  const res = NextResponse.json({ ok: true, user: fullUser }, { status: 201 })
  await setSessionCookie(res, sessionToken)
  return res
}
