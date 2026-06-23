import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/clubhub/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', user: null }, { status: 401 })
  return NextResponse.json({ user })
}
