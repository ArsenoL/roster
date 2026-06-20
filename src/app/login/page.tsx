'use client'

import { useState, useEffect, Suspense } from 'react'
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
  ExternalLink,
  Mail,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { _refreshAuthState, defaultLandingForUser, useAuth } from '@/lib/clubhub/use-auth'

function LoginInner() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token')
  const nextParam = params.get('next')
  const { user } = useAuth()

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [devLink, setDevLink] = useState<string | null>(null)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    if (token) {
      verifyToken(token)
    }
  }, [token])

  // If user is already signed in, redirect to their landing.
  useEffect(() => {
    if (user) {
      const target = defaultLandingForUser(user, nextParam)
      if (typeof window !== 'undefined' && window.location.pathname !== target) {
        router.replace(target)
      }
    }
  }, [user, nextParam, router])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('roster.theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('roster.theme', 'light')
    }
  }

  function redirectAfterLogin(signedInUser: any) {
    const target = defaultLandingForUser(signedInUser, nextParam)
    router.replace(target)
  }

  async function verifyToken(t: string) {
    setStatus('verifying')
    try {
      const res = await fetch('/api/auth/verify-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      })
      if (res.ok) {
        setStatus('success')
        _refreshAuthState()
        try {
          const me = await fetch('/api/auth/me').then((r) => r.json())
          setTimeout(() => redirectAfterLogin(me?.user), 600)
        } catch {
          setTimeout(() => router.replace('/app'), 600)
        }
      } else {
        const data = await res.json()
        setStatus('error')
        setError(data.error || 'Invalid or expired token')
      }
    } catch (e: any) {
      setStatus('error')
      setError(e.message)
    }
  }

  async function requestMagic() {
    if (!email) return
    setStatus('sending')
    setDevLink(null)
    try {
      const res = await fetch('/api/auth/request-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, next: nextParam }),
      })
      if (res.ok) {
        const data = await res.json()
        setStatus('sent')
        // In dev (no SMTP), the API returns the link so we can render a
        // one-tap button. In prod, devLink is undefined and the user just
        // sees the "check your email" message.
        if (data.devLink) setDevLink(data.devLink)
      } else {
        const data = await res.json()
        setStatus('error')
        setError(data.error || 'Failed to send magic link')
      }
    } catch (e: any) {
      setStatus('error')
      setError(e.message)
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
              {status === 'verifying' && 'Verifying your link…'}
              {status === 'success' && 'Signed in'}
              {status === 'sent' && 'Check your email'}
              {(status === 'idle' || status === 'sending' || status === 'error') && 'Sign in with a magic link'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {status === 'verifying' && 'One moment while we confirm the link.'}
              {status === 'success' && 'Redirecting to your dashboard.'}
              {status === 'sent' && `We sent a sign-in link to ${email}. It expires in 15 minutes.`}
              {(status === 'idle' || status === 'sending') &&
                'Enter your school email and we\u2019ll send you a one-time link. No passwords stored.'}
              {status === 'error' && <span className="text-foreground">{error}</span>}
            </p>
          </div>

          {/* Verifying spinner */}
          {status === 'verifying' && (
            <div className="flex items-center gap-3 py-8 border border-border px-4 bg-[var(--vibrant-soft)]">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--vibrant)' }} />
              <span className="text-sm">Verifying…</span>
            </div>
          )}

          {/* Success state */}
          {status === 'success' && (
            <div className="flex items-center gap-3 py-6 border border-border px-4" style={{ background: 'var(--accent-good-soft)' }}>
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--accent-good)' }} />
              <span className="text-sm">Redirecting…</span>
            </div>
          )}

          {/* Idle / sending / error → form */}
          {(status === 'idle' || status === 'sending' || status === 'error') && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="label-mono">
                  School email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@school.edu"
                  className="h-11 field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && requestMagic()}
                  autoFocus
                />
              </div>
              <Button
                className="w-full h-11 bg-[var(--vibrant)] hover:bg-[var(--vibrant-strong)] text-white border-0"
                onClick={requestMagic}
                disabled={!email || status === 'sending'}
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Send magic link <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
              {status === 'error' && (
                <div className="flex items-start gap-2 text-sm border border-border p-3" style={{ color: 'var(--accent-bad)' }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Sent state — show the dev link inline if present (no SMTP), plus
              the standard "use a different email" recovery action. */}
          {status === 'sent' && (
            <div className="space-y-4">
              {devLink && (
                <div className="border p-4" style={{ borderColor: 'var(--vibrant)', background: 'var(--vibrant-soft)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-3.5 w-3.5" style={{ color: 'var(--vibrant)' }} />
                    <span className="label-mono" style={{ color: 'var(--vibrant-strong)' }}>Dev preview</span>
                  </div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--vibrant-strong)' }}>
                    SMTP isn&apos;t configured, so the email didn&apos;t actually leave this server.
                    Open the link below to finish signing in.
                  </p>
                  <a
                    href={devLink}
                    className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 bg-[var(--vibrant)] text-white hover:bg-[var(--vibrant-strong)] transition-colors"
                  >
                    Open sign-in link <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
              <Button variant="outline" className="w-full h-11" onClick={() => { setStatus('idle'); setDevLink(null) }}>
                Use a different email
              </Button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Didn&apos;t get the email? Check your spam folder, or{' '}
                <button
                  onClick={() => { setStatus('idle'); setDevLink(null) }}
                  className="text-foreground link-u"
                >
                  try again
                </button>
                .
              </p>
            </div>
          )}

          {/* Bottom strip — privacy note in plain language */}
          <div className="mt-8 pt-5 border-t border-border">
            <div className="label-mono mb-2">About magic-link sign-in</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We email you a one-time link. Click it within 15 minutes and you&apos;re signed in.
              No password is ever stored, so there&apos;s nothing to leak. Sessions last 14 days on
              this device.
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
