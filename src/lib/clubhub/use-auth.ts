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
    const listener = () => setUser(cachedUser)
    listeners.add(listener)

    async function load() {
      if (cachedUser) return
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

// For internal use — call after successful login to refresh state everywhere
export function _refreshAuthState() {
  // re-fetch from /api/auth/me
  fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
    cachedUser = d?.user || null
    emit()
  }).catch(() => {})
}

/**
 * Pick the default landing page for a signed-in user based on their role and
 * membership state:
 *
 *  - PARENT  → /app/parent
 *  - STUDENT → /app/me
 *  - GUEST with no memberships → /app/onboarding  (they need to create or join a club first)
 *  - everyone else → /app
 *
 * If `next` query param is present and starts with `/`, that wins (as long
 * as it isn't `//`, which would be a protocol-relative URL → open-redirect).
 */
export function defaultLandingForUser(user: AuthUser | null, next?: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (!user) return '/login'
  if (user.role === 'STUDENT') return '/app/me'
  if (user.role === 'PARENT') return '/app/parent'
  // A first-time user with no memberships needs to land on onboarding so they
  // can create or join a club. With password auth this only happens when an
  // admin pre-creates the account without assigning any memberships.
  if (user.role === 'GUEST' && (!user.memberships || user.memberships.length === 0)) {
    return '/app/onboarding'
  }
  // A CLUB_LEADER / ADVISOR / ADMIN who somehow has no active memberships
  // (e.g. they graduated from their only club) also lands on onboarding so
  // they can pick a new one.
  if ((!user.memberships || user.memberships.length === 0) && user.role !== 'SUPER_ADMIN' && user.role !== 'SCHOOL_ADMIN') {
    return '/app/onboarding'
  }
  return '/app'
}
