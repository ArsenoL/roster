import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { clearSessionCookie } from '@/lib/clubhub/auth'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('roster_session')?.value
  if (token) {
    await db.userSession.deleteMany({ where: { token } }).catch(() => {})
  }
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}
