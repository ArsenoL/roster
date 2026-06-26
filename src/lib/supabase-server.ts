/**
 * Server-only Supabase client.
 *
 * This file imports next/headers and must NEVER be imported from a client
 * component. Import from '@/lib/supabase-browser' instead for client-side usage.
 */

import 'server-only'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/** Re-export the browser client for convenience (server components can use it too). */
export { createClient } from '@/lib/supabase-browser'

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
            // Called from a Server Component — safe to ignore.
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
