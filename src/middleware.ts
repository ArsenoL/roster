import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase session refresh middleware.
 *
 * Runs on every request. Reads the Supabase auth cookie, refreshes the
 * access token if it's expired, and writes the refreshed cookie back to
 * the response.
 *
 * IMPORTANT: This middleware ONLY refreshes cookies. It does NOT redirect.
 * Redirect logic is handled by the React components (useAuth hook) and
 * API routes (getCurrentUser returns 401). Putting redirect logic in
 * middleware causes infinite redirect loops when getUser() fails for
 * transient reasons (network, cold start, etc.).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Skip Supabase refresh on auth pages and static assets
  const path = request.nextUrl.pathname
  if (path.startsWith('/login') ||
      path.startsWith('/signup') ||
      path.startsWith('/api/auth/') ||
      path.startsWith('/_next/') ||
      path.startsWith('/favicon')) {
    return response
  }

  // Only attempt Supabase refresh if the env vars are configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // getUser() validates the JWT against the Supabase server and
    // refreshes it if needed. We don't use the return value — we just
    // call it to trigger the cookie refresh side effect.
    await supabase.auth.getUser()
  } catch (e) {
    // If Supabase is unreachable, don't block the request — just proceed
    // without refreshing. The API routes will handle auth themselves.
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|robots\\.txt|logo\\.svg)$).*)',
  ],
}
