'use client'

import { useState, useEffect, useCallback } from 'react'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  memberships?: Array<{
    clubId: string
    clubName: string
    role: string
    status: string
  }>
}

let cachedUser: AuthUser | null = null
let cachedUserAt: number = 0  // timestamp of last server validation (ms)
const listeners = new Set<() => void>()

// Re-validate the cached user against the server at most every 2 minutes.
// Navigations within this window trust the cache; after it, the next mount
// re-fetches /api/auth/me. This balances two concerns:
//   - Avoid flash-of-unauthenticated-state on every navigation (which would
//     happen if we always re-fetched).
//   - Detect server-side session invalidation (expired, signed out in
//     another tab, cookie not sent on a cross-origin request) in a
//     reasonable timeframe instead of trusting a stale cache forever.
const CACHE_TTL_MS = 2 * 60 * 1000

function emit() { listeners.forEach(l => l()) }

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(cachedUser)
  const [loading, setLoading] = useState(!cachedUser)

  useEffect(() => {
    let cancelled = false
    // Listener fires when another part of the app updates cachedUser
    // (e.g. _setAuthedUser after login, or logout). We must both setUser
    // AND clear loading unconditionally — otherwise a consumer that mounted
    // before login (with cachedUser=null → loading=true) would never exit
    // the loading state even after the user becomes available, and a
    // consumer that calls logout() while loading=true would be stuck.
    const listener = () => {
      if (cancelled) return
      setUser(cachedUser)
      setLoading(false)
    }
    listeners.add(listener)

    async function load() {
      // If the cache is fresh (validated within CACHE_TTL_MS), trust it.
      // This avoids a flash of unauthenticated state on every navigation
      // and avoids hammering /api/auth/me on every page mount.
      const now = Date.now()
      if (cachedUser && (now - cachedUserAt) < CACHE_TTL_MS) {
        setLoading(false)
        return
      }

      // Otherwise, re-validate against the server. The cache may be stale
      // because the session was invalidated server-side (expired, signed
      // out in another tab, cookie not sent on a cross-origin request).
      // Without this re-validation the UI would keep showing "signed in"
      // while every API call 401s — the "session keeps expiring" complaint.
      //
      // CRITICAL: if the server returns a null user BUT we previously had
      // a cached user, do NOT immediately null out the cache. There are
      // transient cases (SQLite WAL lag, connection reuse, cookie not sent
      // on a single request) where /api/auth/me returns null even though
      // the session is actually valid. Immediately nulling the cache causes
      // the auth gate to redirect to /login — the "after I make a club it
      // sends me back to the sign in page" bug. Instead, keep the cached
      // user and let the global 401 handler in apiPost/useFetch deal with
      // actual session invalidation (it retries /api/auth/me and only
      // redirects if the retry also says null).
      try {
        const res = await fetch('/api/auth/me')
        if (cancelled) return
        if (res.ok) {
          const d = await res.json()
          if (cancelled) return
          const serverUser = d.user ?? null
          if (serverUser) {
            // Server confirms we're authenticated — update the cache.
            cachedUser = serverUser
            cachedUserAt = now
            setUser(serverUser)
            emit()
          } else if (!cachedUser) {
            // Server says null AND we have no cached user — genuinely
            // signed out. Set user to null so the auth gate redirects.
            setUser(null)
            emit()
          }
          // else: server says null but we have a cached user. Keep the
          // cached user — the global 401 handler will sort it out if the
          // session is actually gone.
        } else if (res.status === 401) {
          // 401 from /api/auth/me. With Supabase Auth, this could mean:
          //   1. The user is genuinely not signed in (no session at all)
          //   2. The access token expired and middleware hasn't refreshed it yet
          //
          // If we have a cached user, DON'T immediately sign them out —
          // give the middleware one chance to refresh the token by retrying
          // after a short delay. Only sign out if the retry also fails.
          if (cachedUser) {
            // Retry once after 500ms — the middleware might refresh the token
            // on the next request
            await new Promise(r => setTimeout(r, 500))
            if (cancelled) return
            const retryRes = await fetch('/api/auth/me')
            if (cancelled) return
            if (retryRes.ok) {
              const retryData = await retryRes.json()
              if (retryData.user) {
                cachedUser = retryData.user
                cachedUserAt = Date.now()
                setUser(retryData.user)
                emit()
                return
              }
            }
          }
          // Genuinely signed out (or retry failed)
          cachedUser = null
          cachedUserAt = 0
          setUser(null)
          emit()
        }
      } catch (e) {
        // Network error — leave cachedUser as-is. The user might be on a
        // flaky connection; we shouldn't sign them out just because a
        // single fetch failed. If the session really is gone, the next
        // API call will 401 and the global handler in apiPost will deal
        // with it.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    return () => {
      cancelled = true
      listeners.delete(listener)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    cachedUser = null
    cachedUserAt = 0
    setUser(null)
    emit()
  }, [])

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    // Try /api/auth/me. If the server returns a non-null user, update the
    // cache and return it. If the server returns null (session invalid),
    // retry once after a short delay — there are transient cases where the
    // first request after a server-side write (e.g. creating a club) doesn't
    // see the updated session row yet, especially under SQLite. If the retry
    // also returns null, the session is genuinely gone and we clear the
    // cache so the auth gate redirects to /login.
    const fetchMe = async (): Promise<AuthUser | null> => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return null
      const d = await res.json()
      return d.user ?? null
    }

    try {
      let serverUser = await fetchMe()
      if (!serverUser) {
        // Wait 300ms and retry once. This handles transient cases where the
        // session row wasn't yet visible to the read query (SQLite WAL
        // replication lag, or the request landing on a stale connection).
        await new Promise((r) => setTimeout(r, 300))
        serverUser = await fetchMe()
      }

      if (serverUser) {
        cachedUser = serverUser
        cachedUserAt = Date.now()
        setUser(serverUser)
        emit()
        return serverUser
      } else {
        // Session is genuinely gone after retry — clear the cache.
        cachedUser = null
        cachedUserAt = 0
        setUser(null)
        emit()
        return null
      }
    } catch (e) {
      // Network error — don't touch the cache. The caller can decide what
      // to do. The global 401 handler will deal with actual session
      // invalidation if a subsequent API call 401s.
      return cachedUser
    }
  }, [])

  return { user, loading, logout, refresh }
}

/** Synchronously inject a known user into the auth cache. Use this right
 *  after a login/signup API returns the user object — it avoids an extra
 *  /api/auth/me round-trip and ensures any consumer that mounts
 *  immediately afterward (e.g. the destination page after a redirect)
 *  sees the user without a flash of unauthenticated state.
 *
 *  Marks the cache as freshly validated so the next useAuth consumer
 *  within CACHE_TTL_MS trusts it without a round-trip. */
export function _setAuthedUser(user: AuthUser): void {
  cachedUser = user
  cachedUserAt = Date.now()
  emit()
}

/**
 * Pick the default landing page for a signed-in user based on their role and
 * membership state:
 *
 *  - PARENT  → /app/parent
 *  - STUDENT with active memberships → /app/me
 *  - SUPER_ADMIN / SCHOOL_ADMIN → /app  (tenant-wide dashboard, no club needed)
 *  - anyone else with active memberships → /app
 *  - anyone else without active memberships → /app/onboarding
 *    (they need to create or join a club first)
 *
 * If `next` query param is present and starts with `/`, that wins (as long
 * as it isn't `//`, which would be a protocol-relative URL → open-redirect).
 */
export function defaultLandingForUser(user: AuthUser | null, next?: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (!user) return '/login'

  const hasMemberships = !!(user.memberships && user.memberships.length > 0)

  // Tenant-wide admins skip the onboarding gate — they manage the whole
  // school, not a single club.
  if (user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN') {
    return '/app'
  }

  // Parents have their own portal that doesn't require a club membership.
  if (user.role === 'PARENT') return '/app/parent'

  // Everyone else (STUDENT, CLUB_LEADER, ADVISOR, GUEST, etc.) needs at
  // least one active membership to have anything to look at. Send them
  // to onboarding so they can create or join a club.
  if (!hasMemberships) return '/app/onboarding'

  // Students land on their personal dashboard; everyone else lands on
  // the club dashboard.
  if (user.role === 'STUDENT') return '/app/me'
  return '/app'
}
