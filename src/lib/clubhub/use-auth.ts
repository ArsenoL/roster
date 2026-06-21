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
const listeners = new Set<() => void>()

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
      setUser(cachedUser)
      setLoading(false)
    }
    listeners.add(listener)

    async function load() {
      if (cachedUser) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const d = await res.json()
          if (!cancelled) {
            cachedUser = d.user
            setUser(d.user)
          }
        }
      } catch (e) {
        // ignore — user is null
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
    setUser(null)
    emit()
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const d = await res.json()
        cachedUser = d.user
        setUser(d.user)
        emit()
      }
    } catch (e) {}
  }, [])

  return { user, loading, logout, refresh }
}

/** Synchronously inject a known user into the auth cache. Use this right
 *  after a login/signup API returns the user object — it avoids an extra
 *  /api/auth/me round-trip and ensures any consumer that mounts
 *  immediately afterward (e.g. the destination page after a redirect)
 *  sees the user without a flash of unauthenticated state. */
export function _setAuthedUser(user: AuthUser): void {
  cachedUser = user
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
