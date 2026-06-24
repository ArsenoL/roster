/**
 * Supabase client helpers.
 *
 * Two flavors:
 *   - `createClient()` — browser-side client (uses anon key + user session)
 *   - `createServerClient()` — server-side client (uses cookies for SSR)
 *   - `createServiceClient()` — server-side admin client (bypasses RLS)
 *
 * The browser client is used by the `useAuth` hook and login/signup pages.
 * The server client is used by `getCurrentUser()` to read the session.
 * The service client is used for admin operations (migrating users, etc.).
 */

import { createBrowserClient } from '@supabase/ssr'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Browser-side Supabase client. Uses the anon key + user's session cookie. */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}

/** Server-side Supabase client that reads/writes cookies for SSR auth. */
export async function createServerClient() {
  const cookieStore = await cookies()
  return createSSRClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

/** Service-role Supabase client — bypasses RLS. Server-only, never expose. */
export function createServiceClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
