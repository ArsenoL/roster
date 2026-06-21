'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { _setAuthedUser, defaultLandingForUser, useAuth } from '@/lib/clubhub/use-auth'
import { useDarkMode } from '@/lib/clubhub/use-dark-mode'

function LoginInner() {
  const params = useSearchParams()
  const router = useRouter()
  const nextParam = params.get('next')
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const { dark, toggle: toggleDark } = useDarkMode()

  const redirectAfterLogin = useCallback(
    (signedInUser: any) => {
      const target = defaultLandingForUser(signedInUser, nextParam)
      router.replace(target)
    },
    [nextParam, router]
  )

  // If user is already signed in, redirect to their landing.
  useEffect(() => {
    if (user) {
      const target = defaultLandingForUser(user, nextParam)
      if (typeof window !== 'undefined' && window.location.pathname !== target) {
        router.replace(target)
      }
    }
  }, [user, nextParam, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        // The login API already returned the user — inject it directly into
        // the auth cache so the destination page (mounted by the redirect
        // below) sees the user immediately, with no flash of unauthenticated
        // state and no extra /api/auth/me round-trip.
        _setAuthedUser(data.user)
        redirectAfterLogin(data.user)
      } else {
        setStatus('error')
        setError(data.error || 'Incorrect email or password')
      }
    } catch (e: any) {
      setStatus('error')
      setError(e.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              club operations
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/demo"
              className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
            >
              Try a demo
            </Link>
            <Button variant="ghost" size="sm" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 py-12">
        <div className="w-full max-w-md">
          {/* Accent ribbon — small, vibrant, breaks the brutalism */}
          <div className="h-1 w-16 bg-[var(--vibrant)] mb-6" />

          {/* Status title */}
          <div className="mb-6">
            <div className="label-mono mb-2">Sign in</div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {status === 'success' ? 'Signed in' : 'Welcome back'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {status === 'success'
                ? 'Redirecting to your dashboard.'
                : 'Enter your email and password to sign in to your account.'}
            </p>
          </div>

          {/* Success state */}
          {status === 'success' && (
            <div
              className="flex items-center gap-3 py-6 border px-4 mb-4"
              style={{ background: 'var(--accent-good-soft)' }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--accent-good)' }} />
              <span className="text-sm">Redirecting…</span>
            </div>
          )}

          {/* Login form */}
          {status !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="label-mono">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@school.edu"
                  className="h-11 field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="label-mono">
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground link-u"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="h-11 field pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[var(--vibrant)] hover:bg-[var(--vibrant-strong)] text-white border-0"
                disabled={!email || !password || status === 'sending'}
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>

              {status === 'error' && (
                <div
                  className="flex items-start gap-2 text-sm border p-3"
                  style={{ color: 'var(--accent-bad)', borderColor: 'var(--accent-bad)' }}
                >
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}

          {/* Sign-up link */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href={nextParam ? `/signup?next=${encodeURIComponent(nextParam)}` : '/signup'}
              className="text-foreground link-u font-medium"
            >
              Create one
            </Link>
          </div>

          {/* Bottom strip — security note in plain language */}
          <div className="mt-8 pt-5 border-t border-border">
            <div className="label-mono mb-2">About your password</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your password is hashed with scrypt before it touches our database — we never see
              the plaintext. Sessions last 14 days on this device. Sign out from the account
              menu any time.
            </p>
          </div>

          {/* Footer links */}
          <div className="mt-6 flex items-center justify-between text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              ← Back to home
            </Link>
            <Link href="/demo" className="text-muted-foreground hover:text-foreground">
              Try a demo first →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  )
}
