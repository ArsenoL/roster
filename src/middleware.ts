import { NextRequest, NextResponse } from 'next/server'

/**
 * Minimal middleware — does NOT touch Supabase.
 * 
 * The Supabase session refresh is handled inside getCurrentUser() via
 * getUser(), which is called on every API request. No middleware needed.
 * 
 * Previous versions of this file called supabase.auth.getUser() on every
 * request, which caused 2s latency, race conditions, and redirect loops.
 * It's been removed. Keep this file as a no-op so the matcher doesn't
 * interfere.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|robots\\.txt|logo\\.svg)$).*)'],
}
