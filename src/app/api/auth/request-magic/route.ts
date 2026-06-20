import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enqueueEmail } from '@/lib/clubhub/dispatchers'

/**
 * POST /api/auth/request-magic
 * Body: { email, next? }
 * Creates a magic-link token and emails it. Always returns 200 (don't leak
 * whether the email exists). The `next` parameter is appended to the magic
 * link so the user lands on the page they intended to reach after sign-in.
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
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15)  // 15 min

  await db.magicLink.create({
    data: { email, token, expiresAt }
  })

  // Look up user to customize the email
  const user = await db.user.findUnique({ where: { email } })
  const firstName = user?.name?.split(' ')[0] || 'there'

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`
  const link = `${baseUrl}/login?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ''}`

  await enqueueEmail({
    toEmail: email,
    toName: firstName,
    subject: 'Your Roster sign-in link',
    body: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px">
      <h2>Sign in to Roster</h2>
      <p>Hi ${firstName},</p>
      <p>Click the button below to sign in to your Roster account. This link expires in 15 minutes.</p>
      <p style="margin:30px 0">
        <a href="${link}" style="background:#0f766e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">Sign in to Roster</a>
      </p>
      <p style="color:#999;font-size:13px">If you didn't request this link, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
      <p style="color:#999;font-size:12px">Or paste this URL into your browser:<br /><a href="${link}">${link}</a></p>
    </div>`,
    mergeData: { name: firstName, link },
  })

  return NextResponse.json({ ok: true, message: 'Magic link sent' })
}
