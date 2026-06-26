import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Supabase session refresh middleware.
 *
 * Only runs the Supabase refresh if the user actually HAS a Supabase cookie.
 * For legacy users (who only have roster_session), we skip the Supabase
 * network call entirely — it adds ~2s latency to every request and provides
 * no value.
 *
 * IMPORTANT: This middleware ONLY refreshes cookies. It does NOT redirect.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const path = request.nextUrl.pathname

  // Skip on auth pages and static assets
  if (path.startsWith('/login') ||
      path.startsWith('/signup') ||
      path.startsWith('/api/auth/') ||
      path.startsWith('/_next/') ||
      path.startsWith('/favicon')) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return response
  }

  // Only attempt Supabase refresh if the user has a Supabase auth cookie.
  // Legacy users (roster_session only) don't need this — skip the 2s
  // network call to Supabase.
  const hasSupabaseCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.includes('auth-token')
  )
  if (!hasSupabaseCookie) {
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

    // getUser() validates the JWT and refreshes it if needed.
    await supabase.auth.getUser()
  } catch (e) {
    // If Supabase is unreachable, don't block the request.
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|robots\\.txt|logo\\.svg)$).*)',
  ],
}
