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
    fetch(url)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        if (!cancelled) dispatch({ type: 'success', data: json })
      })
      .catch(e => {
        if (!cancelled) dispatch({ type: 'error', error: e.message })
      })

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

export async function apiPost(url: string, body: any) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
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
    const err = await r.json().catch(() => ({ error: r.statusText }))
    const e: any = new Error(err.error || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return r.json()
}
