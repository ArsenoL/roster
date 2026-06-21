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

function SignupInner() {
  const params = useSearchParams()
  const router = useRouter()
  const nextParam = params.get('next')
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const { dark, toggle: toggleDark } = useDarkMode()

  const redirectAfterSignup = useCallback(
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

  // Basic client-side checks — the server validates too, this just gives
  // instant feedback before the round-trip.
  function clientValidate(): string | null {
    if (!name.trim()) return 'Please enter your name'
    if (name.trim().length > 80) return 'Name is too long (max 80 chars)'
    if (!email) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return 'Password must include both letters and numbers'
    }
    if (password !== confirm) return 'Passwords do not match'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = clientValidate()
    if (err) {
      setStatus('error')
      setError(err)
      return
    }

    setStatus('sending')
    setError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.toLowerCase().trim(), password }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        // Inject the freshly-created user into the auth cache so the
        // destination page sees it immediately on mount.
        _setAuthedUser(data.user)
        redirectAfterSignup(data.user)
      } else {
        setStatus('error')
        setError(data.error || 'Could not create account')
      }
    } catch (e: any) {
      setStatus('error')
      setError(e.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              club operations
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="h-1 w-16 bg-[var(--vibrant)] mb-6" />

          <div className="mb-6">
            <div className="label-mono mb-2">Create your account</div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {status === 'success' ? 'Account created' : 'Join Roster'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {status === 'success'
                ? 'Redirecting to your dashboard.'
                : 'Sign up to manage your club — attendance, members, events, and more.'}
            </p>
          </div>

          {status === 'success' && (
            <div
              className="flex items-center gap-3 py-6 border px-4 mb-4"
              style={{ background: 'var(--accent-good-soft)' }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--accent-good)' }} />
              <span className="text-sm">Redirecting…</span>
            </div>
          )}

          {status !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="label-mono">
                  Full name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Alex Chen"
                  className="h-11 field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                  required
                />
              </div>

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
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="label-mono">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    className="h-11 field pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
                <p className="text-xs text-muted-foreground">
                  Use 8+ characters with at least one letter and one number.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="label-mono">
                  Confirm password
                </Label>
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  className="h-11 field"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[var(--vibrant)] hover:bg-[var(--vibrant-strong)] text-white border-0"
                disabled={!name || !email || !password || !confirm || status === 'sending'}
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account…
                  </>
                ) : (
                  <>
                    Create account <ArrowRight className="h-4 w-4 ml-2" />
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

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}
              className="text-foreground link-u font-medium"
            >
              Sign in
            </Link>
          </div>

          <div className="mt-8 pt-5 border-t border-border">
            <div className="label-mono mb-2">About your password</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your password is hashed with scrypt (per-user salt, N=2¹⁵) before it touches our
              database — we never see the plaintext. Sessions last 14 days on this device.
            </p>
          </div>

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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignupInner />
    </Suspense>
  )
}
