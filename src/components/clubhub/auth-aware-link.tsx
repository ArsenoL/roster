'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/clubhub/use-auth'

/**
 * AuthAwareLink — a Link that goes directly to `href` when the user is signed
 * in, and to `/login?next=<href>` when they're not. This fixes the bug where
 * a signed-in user clicking a "Create a club" CTA on the landing page would
 * be sent to /login (and see the "Sign in" form) instead of going straight
 * to /app/onboarding.
 *
 * Use this anywhere a public page has a CTA meant to drop the user into the
 * authenticated app. Don't use it on already-gated pages (e.g. /app/*) —
 * those should just use a plain Link since the user is guaranteed to be
 * signed in (or about to be redirected to /login by the auth gate).
 *
 * Props:
 *  - href: where to send a signed-in user
 *  - fallback: optional — where to send a signed-out user. Defaults to
 *    `/login?next=<encoded href>`. Pass a custom fallback only if the
 *    signed-out destination differs (e.g. /signup instead of /login).
 *  - all standard <Link> props (className, onClick, children, etc.)
 */
export function AuthAwareLink({
  href,
  fallback,
  children,
  ...rest
}: {
  href: string
  fallback?: string
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const { user } = useAuth()
  const target = user
    ? href
    : (fallback ?? `/login?next=${encodeURIComponent(href)}`)
  return (
    <Link href={target} {...rest}>
      {children}
    </Link>
  )
}
