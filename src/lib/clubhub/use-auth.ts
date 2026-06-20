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
 * Pick the default landing page for a signed-in user based on their role.
 * - STUDENT → /app/me (personal dashboard)
 * - PARENT  → /app/parent (children overview)
 * - everyone else → /app (admin dashboard)
 *
 * If `next` query param is present and starts with `/`, that wins.
 */
export function defaultLandingForUser(user: AuthUser | null, next?: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  if (!user) return '/login'
  if (user.role === 'STUDENT') return '/app/me'
  if (user.role === 'PARENT') return '/app/parent'
  return '/app'
}
