import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { clearSessionCookie } from '@/lib/clubhub/auth'
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  // Sign out of Supabase Auth (clears the Supabase session cookies)
  const supabase = await createServerClient()
  await supabase.auth.signOut()

  // Also clear the legacy roster_session cookie + delete the session row
  const cookieStore = await cookies()
  const token = cookieStore.get('roster_session')?.value
  if (token) {
    await db.userSession.deleteMany({ where: { token } }).catch(() => {})
  }
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}
