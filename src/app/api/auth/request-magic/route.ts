import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'

/**
 * POST /api/auth/request-magic
 * Body: { email, next? }
 *
 * Creates a magic-link token, emails it, and (in dev only) returns the link
 * in the JSON so the login page can render a one-tap "Open the link" button.
 *
 * In production the link is sent only via email — it is never returned in the
 * response body. We also always return 200 (don't leak whether the email
 * exists) so this can't be used as an account-enumeration oracle.
 *
 * The `next` parameter is appended to the magic link so the user lands on the
 * page they intended to reach after sign-in. Must start with `/` and be on
 * this origin (open-redirect prevention).
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const email = String(body.email || '').toLowerCase().trim()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Optional `next` path — must start with `/` and be on this origin.
  // We do not allow external URLs (open-redirect prevention).
  let next = String(body.next || '').trim()
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    next = ''
  }

  const { randomBytes } = await import('crypto')
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now()  + 1000 * 60 * 15)  // 15 min

  await db.magicLink.create({
    data: { email, token, expiresAt }
  })

  // Look up user to customize the email
  const user = await db.user.findUnique({ where: { email } })
  const firstName = user?.name?.split(' ')[0] || 'there'

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`
  const link = `${baseUrl}/login?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ''}`

  // Always queue the email — if SMTP is configured it actually sends; if not,
  // the dispatcher writes to EmailQueue with a FAILED status but the link
  // itself is still valid (we return it in dev below so the user can click).
  await enqueueEmail({
    toEmail: email,
    toName: firstName,
    subject: 'Your Roster sign-in link',
    body: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:600">Sign in to Roster</h2>
      <p style="margin:0 0 12px 0;color:#4a4a4a">Hi ${firstName},</p>
      <p style="margin:0 0 24px 0;color:#4a4a4a;line-height:1.55">
        Click the button below to sign in. This link expires in 15 minutes and only works once.
      </p>
      <p style="margin:0 0 24px 0">
        <a href="${link}" style="display:inline-block;background:#0f766e;color:white;padding:12px 28px;text-decoration:none;font-weight:600;border-radius:6px;font-size:14px">
          Sign in to Roster
        </a>
      </p>
      <p style="margin:0 0 16px 0;color:#888;font-size:13px;line-height:1.5">
        If you didn't request this link, you can safely ignore this email — no one else can use it.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
      <p style="margin:0;color:#888;font-size:12px;line-height:1.5">
        Or paste this URL into your browser:<br />
        <a href="${link}" style="color:#666;word-break:break-all">${link}</a>
      </p>
    </div>`,
    mergeData: { name: firstName, link },
  })

  // In dev (no SMTP configured), return the link so the login page can show
  // a one-tap "Open the link" button. This makes the magic-link flow
  // fully testable without an email provider. In prod this field is omitted.
  const isDev = process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST
  return NextResponse.json({
    ok: true,
    message: 'Magic link sent',
    ...(isDev ? { devLink: link, devNote: 'SMTP not configured — link shown here for dev.' } : {}),
  })
}
