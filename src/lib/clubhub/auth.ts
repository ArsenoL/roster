/**
 * Lightweight auth — email + password login, signed session cookie.
 *
 * Why not next-auth? next-auth is configured in package.json but the OAuth
 * providers all require external credentials (Google, GitHub, etc.). For a
 * high-school-club tool, simple email + password is the lowest-friction auth
 * that works without third-party setup.
 *
 * Flow:
 *   1. User signs up → POST /api/auth/signup { name, email, password }
 *      → server hashes password (scrypt), creates User, sets session cookie
 *   2. User logs in → POST /api/auth/login { email, password }
 *      → server verifies password, sets session cookie
 *   3. Subsequent requests send cookie → server-side `getCurrentUser()`
 *      looks up session by token
 *   4. POST /api/auth/logout → invalidates session
 *
 * Roles: stored on User.role (SUPER_ADMIN | SCHOOL_ADMIN | ADVISOR | CLUB_LEADER | STUDENT | PARENT | GUEST)
 * Per-club roles: stored on Membership.role (PRESIDENT | VICE_PRESIDENT | TREASURER | SECRETARY | COMMITTEE_HEAD | MEMBER | PROBATIONARY)
 *
 * `requireRole()` is a server-side guard for API routes.
 */

import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions
) => Promise<Buffer>

const SESSION_COOKIE = 'roster_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14  // 14 days

// scrypt parameters — N=2^15 (cost), r=8 (block size), p=1 (parallelism).
// These are conservative, well-tested defaults that take ~80ms on a modern
// CPU. Tunable via env if you need stronger (or faster) hashing.
const SCRYPT_KEYLEN = 64
const SCRYPT_PARAMS: ScryptOptions = {
  N: 1 << 15,
  r: 8,
  p: 1,
  maxmem: 128 * SCRYPT_KEYLEN * (1 << 15),
}

/** Hash a password with scrypt + per-user salt.
 *  Returns a single string: `scrypt$<saltHex>$<hashHex>` so verification
 *  can pull both pieces back out. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)
  return `scrypt$${salt}$${derived.toString('hex')}`
}

/** Verify a password against a stored `scrypt$salt$hash` string.
 *  Uses timingSafeEqual to prevent timing attacks. Returns true on match,
 *  false on any mismatch, malformed hash, or null hash. */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored || !stored.startsWith('scrypt$')) return false
  const parts = stored.split('$')
  if (parts.length !== 3) return false
  const [, salt, hashHex] = parts
  try {
    const expected = Buffer.from(hashHex, 'hex')
    const derived = await scrypt(password, salt, expected.length, SCRYPT_PARAMS)
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/** Validate password strength — returns null if OK, or an error string. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 200) return 'Password is too long (max 200 chars)'
  // Require at least one letter and one number — keeps it friendly for
  // students while preventing trivial passwords like "11111111".
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include both letters and numbers'
  }
  return null
}

/** Validate email format — basic RFC-ish check, good enough for our purposes. */
export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required'
  if (email.length > 254) return 'Email is too long'
  // Same regex used by the HTML5 email input type — pragmatic, not strict RFC.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'Please enter a valid email address'
  return null
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  globalRole: string
  memberships: Array<{
    clubId: string
    clubName: string
    role: string
    status: string
  }>
}

/** Sign a token with HMAC. */
async function signToken(payload: string): Promise<string> {
  const { createHmac } = await import('crypto')
  const secret = process.env.AUTH_SECRET || 'roster-dev-secret-change-me'
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/** Compute the expected HMAC signature for a given payload. */
async function computeSig(payload: string): Promise<string> {
  const { createHmac } = await import('crypto')
  const secret = process.env.AUTH_SECRET || 'roster-dev-secret-change-me'
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/** Verify a signed token. Returns the payload if valid, null otherwise. */
async function verifyToken(token: string): Promise<string | null> {
  const idx = token.lastIndexOf('.')
  if (idx === -1) return null
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = await computeSig(payload)
  // Use timingSafeEqual-style comparison to prevent timing attacks
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0 ? payload : null
}

/** Generate a new session token (signed). */
export async function generateSessionToken(userId: string): Promise<string> {
  const { randomBytes } = await import('crypto')
  const raw = `${userId}.${randomBytes(32).toString('hex')}.${Date.now()}`
  return signToken(raw)
}

/** Get the current authenticated user (server-side). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const verified = await verifyToken(token)
  if (!verified) return null

  const session = await db.userSession.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { club: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  // Touch lastUsed
  db.userSession.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
  }).catch(() => {})

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    globalRole: session.user.role,
    memberships: session.user.memberships.map((m) => ({
      clubId: m.clubId,
      clubName: m.club.name,
      role: m.role,
      status: m.status,
    })),
  }
}

/** Set the session cookie on a NextResponse. */
export async function setSessionCookie(
  res: NextResponse,
  token: string
): Promise<void> {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  })
}

/** Clear the session cookie. */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.delete(SESSION_COOKIE)
}

/** Permission matrix — per-club role → allowed actions. */
const PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  SCHOOL_ADMIN: ['*'],
  ADVISOR: ['club:read', 'club:write', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'finance:write', 'announcements:write', 'attendance:write', 'insights:read', 'audit:read'],
  CLUB_LEADER: ['club:read', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'announcements:write', 'attendance:write', 'insights:read'],
  PRESIDENT: ['club:read', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'announcements:write', 'attendance:write'],
  VICE_PRESIDENT: ['club:read', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'announcements:write', 'attendance:write'],
  TREASURER: ['club:read', 'members:read', 'finance:read', 'finance:write'],
  SECRETARY: ['club:read', 'members:read', 'events:read', 'events:write', 'announcements:write', 'attendance:write'],
  COMMITTEE_HEAD: ['club:read', 'members:read', 'events:read', 'events:write', 'attendance:write'],
  MEMBER: ['club:read', 'members:read', 'events:read'],
  PARENT: ['club:read', 'members:read', 'attendance:read'],
  GUEST: ['club:read'],
}

/** Check whether the user has a specific permission in a specific club. */
export function hasPermission(
  user: AuthUser | null,
  permission: string,
  clubId?: string
): boolean {
  if (!user) return false

  // Global role check (SUPER_ADMIN, SCHOOL_ADMIN)
  if (PERMISSIONS[user.globalRole]?.includes('*')) return true
  if (PERMISSIONS[user.globalRole]?.includes(permission)) return true

  // Per-club role check
  if (clubId) {
    const membership = user.memberships.find((m) => m.clubId === clubId)
    if (membership) {
      if (PERMISSIONS[membership.role]?.includes('*')) return true
      if (PERMISSIONS[membership.role]?.includes(permission)) return true
    }
  }

  return false
}

/** Server-side guard for API routes — returns user or 401 response. */
export async function requireAuth(req?: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}

/** Guard that also checks a permission. */
export async function requirePermission(
  permission: string,
  clubId?: string
): Promise<AuthUser | NextResponse> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!hasPermission(user, permission, clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}
