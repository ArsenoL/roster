import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateSessionToken, setSessionCookie } from '@/lib/clubhub/auth'

/**
 * POST /api/auth/verify-magic
 * Body: { token }
 * Verifies the token, creates a user session, sets the cookie.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const token = String(body.token || '')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const ml = await db.magicLink.findUnique({ where: { token } })
  if (!ml || ml.usedAt || ml.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  // Find or create user
  let user = await db.user.findUnique({ where: { email: ml.email } })
  if (!user) {
    // Auto-create a guest user — they'll need an admin to assign a role/club
    user = await db.user.create({
      data: {
        email: ml.email,
        name: ml.email.split('@')[0],
        role: 'GUEST',
      }
    })
  }

  // Mark magic link used
  await db.magicLink.update({
    where: { id: ml.id },
    data: { usedAt: new Date() }
  })

  // Create session
  const sessionToken = await generateSessionToken(user.id)
  await db.userSession.create({
    data: {
      userId: user.id,
      token: sessionToken,
      ipAddress: req.headers.get('x-forwarded-for') || null,
      userAgent: req.headers.get('user-agent') || null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    }
  })

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
  await setSessionCookie(res, sessionToken)
  return res
}
