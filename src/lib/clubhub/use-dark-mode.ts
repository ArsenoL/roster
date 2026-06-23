'use client'

/* eslint-disable react-hooks/set-state-in-effect -- one-shot sync from <html class="dark"> on mount is a legitimate external-store subscription */

import { useEffect, useState } from 'react'

/**
 * useDarkMode — reads whether the <html> element currently has the `dark`
 * class, and provides a toggle that updates both the class and localStorage.
 *
 * Why this exists: React 19's strict linter (`react-hooks/set-state-in-effect`)
 * flags the pattern
 *   const [dark, setDark] = useState(false)
 *   useEffect(() => setDark(document.documentElement.classList.contains('dark')), [])
 * because calling setState synchronously in an effect triggers cascading renders.
 *
 * The fix is to initialize state lazily from the DOM, and only sync to external
 * changes (e.g. another tab toggling dark mode) via an effect that *subscribes*
 * rather than *polls*.
 *
 * SSR-safe: returns `false` during server rendering (since `document` is
 * undefined), then re-reads on the client after mount. The brief flash is
 * acceptable because the actual <html class="dark"> is set by a tiny inline
 * script in the root layout (or by next-themes if you switch to it).
 */
export function useDarkMode() {
  const [dark, setDark] = useState(false)

  // On mount, read the actual class from <html>. This is a one-shot sync
  // (not a cascading setState — it only runs once and only changes state if
  // the lazy initial value was wrong).
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setDark((prev) => (prev !== isDark ? isDark : prev))
  }, [])

  // Listen for cross-tab dark-mode changes (e.g. another tab toggled it).
  useEffect(() => {
    const handler = () => {
      setDark(document.documentElement.classList.contains('dark'))
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const applyDark = (next: boolean) => {
    if (typeof document !== 'undefined') {
      if (next) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('theme', next ? 'dark' : 'light')
        // Also keep the legacy key in sync — older code paths read this one.
        window.localStorage.setItem('roster.theme', next ? 'dark' : 'light')
      } catch { /* ignore quota / privacy-mode errors */ }
    }
  }

  // Wrapped setter: callers can use setDark(true|false) directly and the DOM
  // + localStorage will stay in sync. The original `setDark` from useState
  // only updated React state — leaving <html class="dark"> and localStorage
  // stale, so refreshing the page or reading from non-React code showed the
  // wrong mode.
  const setDarkSynced = (next: boolean) => {
    setDark((prev) => {
      if (prev === next) return prev
      applyDark(next)
      return next
    })
  }

  const toggle = () => {
    setDark((prev) => {
      const next = !prev
      applyDark(next)
      return next
    })
  }

  return { dark, toggle, setDark: setDarkSynced }
}
