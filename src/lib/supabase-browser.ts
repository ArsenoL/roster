/**
 * Browser-safe Supabase client.
 *
 * This file is safe to import from client components (pages, hooks, etc.).
 * It does NOT import any server-only APIs like next/headers.
 *
 * For server-side usage, import from '@/lib/supabase-server' instead.
 */

import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Browser-side Supabase client. Uses the anon key + user's session cookie. */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
