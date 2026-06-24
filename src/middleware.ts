import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase session refresh middleware.
 *
 * Runs on every request. Reads the Supabase auth cookie, refreshes the
 * access token if it's expired, and writes the refreshed cookie back to
 * the response. Without this, the access token expires after 1 hour
 * and the user gets silently logged out.
 *
 * This is the #1 most common Supabase SSR gotcha — without middleware,
 * sessions don't persist.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set on both the request (so downstream handlers see it)
            // and the response (so the browser persists it)
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: getUser() (not getSession()) — this validates the JWT
  // against the Supabase server and refreshes it if needed. getSession()
  // just reads the cookie without refreshing, which is why sessions die
  // without this middleware call.
  const { data: { user } } = await supabase.auth.getUser()

  // If there's no user and we're on a protected route, redirect to login.
  // But don't redirect API routes — they handle auth themselves.
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/app') ||
                           request.nextUrl.pathname.startsWith('/api/') &&
                           !request.nextUrl.pathname.startsWith('/api/auth/') &&
                           !request.nextUrl.pathname.startsWith('/api/public/') &&
                           !request.nextUrl.pathname.startsWith('/api/rsvp/public') &&
                           !request.nextUrl.pathname.startsWith('/api/kiosk')

  if (!user && isProtectedRoute && !request.nextUrl.pathname.startsWith('/api/')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     *
     * We DO match /api/* and /app/* so the session is refreshed on every
     * authenticated request.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|robots\\.txt|logo\\.svg)$).*)',
  ],
}
