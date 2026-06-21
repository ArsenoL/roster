'use client'

import { useState, useEffect, useCallback, useReducer, useSyncExternalStore } from 'react'

// Simple external store for current club selection (avoids hydration mismatch
// by reading from localStorage only after mount, via useSyncExternalStore).
let currentClubId = 'ALL'
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

function getSnapshot() {
  return currentClubId
}

// Server snapshot must match the initial client render to avoid hydration mismatch
function getServerSnapshot() {
  return 'ALL'
}

// Hydrate from localStorage on the client side once (after first paint).
if (typeof window !== 'undefined') {
  try {
    const stored = window.localStorage.getItem('roster.currentClub')
    if (stored && stored !== currentClubId) {
      currentClubId = stored
    }
  } catch (e) { /* ignore */ }
}

export function useCurrentClub() {
  const clubId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const setClubId = useCallback((v: string) => {
    currentClubId = v
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('roster.currentClub', v)
    }
    emit()
  }, [])
  return [clubId, setClubId] as const
}

// Generic fetcher hook with auto-refresh capability
type FetchState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

type FetchAction<T> =
  | { type: 'start' }
  | { type: 'success', data: T }
  | { type: 'error', error: string }

function fetchReducer<T>(state: FetchState<T>, action: FetchAction<T>): FetchState<T> {
  switch (action.type) {
    case 'start': return { ...state, loading: true, error: null }
    case 'success': return { data: action.data, loading: false, error: null }
    case 'error': return { ...state, loading: false, error: action.error }
    default: return state
  }
}

export function useFetch<T = any>(url: string | null, opts?: { refresh?: number }) {
  const [state, dispatch] = useReducer(fetchReducer<T>, { data: null, loading: !!url, error: null })
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    if (!url) return
    let cancelled = false
    dispatch({ type: 'start' })

    async function run() {
      try {
        let r = await fetch(url!)
        // 401 recovery — same logic as apiPost. If the session is gone,
        // recoverFrom401 redirects to /login. If it's still valid (race),
        // retry the fetch once.
        if (r.status === 401) {
          const recovered = await recoverFrom401()
          if (recovered) {
            r = await fetch(url!)
          } else {
            // Recovery redirected to /login. Show a generic "session
            // expired" error in the UI; the redirect is already in flight.
            if (!cancelled) dispatch({ type: 'error', error: 'Session expired' })
            return
          }
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        if (!cancelled) dispatch({ type: 'success', data: json })
      } catch (e: any) {
        if (!cancelled) dispatch({ type: 'error', error: e.message })
      }
    }
    run()

    let timer: any
    if (opts?.refresh) {
      timer = setInterval(() => setRefreshKey(k => k + 1), opts.refresh)
    }
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [url, refreshKey, opts?.refresh])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    setData: (data: T | null) => dispatch({ type: 'success', data: data as T })
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Global 401 recovery
//
// When any API call returns 401, we re-validate the session by calling
// /api/auth/me. If that also returns no user, the session really is gone
// and we redirect to /login with a `next` param so the user can sign back
// in and resume what they were doing.
//
// This centralizes the recovery that was previously duplicated (and only
// partially implemented) in /app/onboarding. Callers don't need to handle
// 401 themselves — they just get the error and show it, and the redirect
// happens automatically.
//
// We track `isRefreshing` to avoid stampeding /api/auth/me when multiple
// API calls fail simultaneously (e.g. a dashboard page that fires 5
// requests in parallel and they all 401).
// ──────────────────────────────────────────────────────────────────────────

let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

async function recoverFrom401(): Promise<boolean> {
  // If a refresh is already in flight, piggyback on it instead of firing
  // another /api/auth/me request.
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }
  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const d = await res.json()
        if (d.user) {
          // Session is actually valid — maybe the 401 was a transient
          // race (e.g. session was being renewed when the original
          // request came in). Tell the caller to retry.
          return true
        }
      }
      // Session is genuinely gone. Redirect to login, preserving the
      // current path so the user lands back where they were after
      // re-authenticating.
      if (typeof window !== 'undefined') {
        const current = window.location.pathname + window.location.search
        // Don't redirect to /login as `next` (would create a loop).
        const next = current.startsWith('/login') ? '' : `?next=${encodeURIComponent(current)}`
        window.location.href = `/login${next}`
      }
      return false
    } catch {
      // Network error during recovery — can't determine session state.
      // Don't redirect; let the caller surface the original 401 error.
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function apiPost(url: string, body: any) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    // 401 → try to recover the session. If recovery succeeds (session is
    // still valid), retry the original request once. If recovery fails,
    // the user is redirected to /login by recoverFrom401().
    if (r.status === 401) {
      const recovered = await recoverFrom401()
      if (recovered) {
        // Retry the original request with the same body.
        const r2 = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (r2.ok) return r2.json()
        const err2 = await r2.json().catch(() => ({ error: r2.statusText }))
        const e2: any = new Error(err2.error || `HTTP ${r2.status}`)
        e2.status = r2.status
        throw e2
      }
      // Recovery redirected to /login. Throw a silent error so the caller
      // doesn't show a confusing toast while the redirect is in flight.
      const e: any = new Error('Session expired. Redirecting to login…')
      e.status = 401
      e.silent = true
      throw e
    }
    const err = await r.json().catch(() => ({ error: r.statusText }))
    // Attach the HTTP status to the thrown Error so callers can branch on it
    // (e.g. on 401 → redirect to /login instead of showing a misleading toast).
    // The Error message stays the API's `error` field, so existing toasts
    // keep working unchanged.
    const e: any = new Error(err.error || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return r.json()
}

export async function apiPatch(url: string, body: any) {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    if (r.status === 401) {
      const recovered = await recoverFrom401()
      if (recovered) {
        const r2 = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (r2.ok) return r2.json()
        const err2 = await r2.json().catch(() => ({ error: r2.statusText }))
        const e2: any = new Error(err2.error || `HTTP ${r2.status}`)
        e2.status = r2.status
        throw e2
      }
      const e: any = new Error('Session expired. Redirecting to login…')
      e.status = 401
      e.silent = true
      throw e
    }
    const err = await r.json().catch(() => ({ error: r.statusText }))
    const e: any = new Error(err.error || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return r.json()
}

export async function apiDelete(url: string) {
  const r = await fetch(url, { method: 'DELETE' })
  if (!r.ok) {
    if (r.status === 401) {
      const recovered = await recoverFrom401()
      if (recovered) {
        const r2 = await fetch(url, { method: 'DELETE' })
        if (r2.ok) return r2.json()
        const err2 = await r2.json().catch(() => ({ error: r2.statusText }))
        const e2: any = new Error(err2.error || `HTTP ${r2.status}`)
        e2.status = r2.status
        throw e2
      }
      const e: any = new Error('Session expired. Redirecting to login…')
      e.status = 401
      e.silent = true
      throw e
    }
    const err = await r.json().catch(() => ({ error: r.statusText }))
    const e: any = new Error(err.error || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return r.json()
}
