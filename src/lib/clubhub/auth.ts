/**
 * Auth + permissions — pure Supabase Auth.
 *
 * All legacy scrypt/HMAC/session-token code has been removed. Authentication
 * is handled entirely by Supabase Auth. This file provides:
 *   - getCurrentUser() — reads the Supabase session and looks up our User row
 *   - shapeAuthUser() — converts a Prisma User to the AuthUser DTO
 *   - hasPermission() / requireAuth() / requirePermission() — permission checks
 *
 * The permission matrix is application-level (not RLS) — it supplements the
 * database-level RLS policies for finer-grained control.
 */

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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

/** Validate password strength — returns null if OK, or an error string. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password.length > 200) return 'Password is too long (max 200 chars)'
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include both letters and numbers'
  }
  return null
}

/** Validate email format — basic RFC-ish check. */
export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required'
  if (email.length > 254) return 'Email is too long'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return 'Please enter a valid email address'
  return null
}

/** Get the current authenticated user (server-side).
 *  Pure Supabase Auth. Uses getUser() which validates the JWT server-side.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { createServerClient } = await import('@/lib/supabase-server')
    const supabase = await createServerClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser?.id) return null

    // Look up our User row by supabaseAuthId
    const user = await db.user.findFirst({
      where: { supabaseAuthId: authUser.id },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { club: { select: { id: true, name: true } } },
        },
      },
    })

    if (user) return shapeAuthUser(user)

    // User exists in auth.users but not in public."User" — create/link them
    if (authUser.email) {
      const existing = await db.user.findUnique({
        where: { email: authUser.email },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { club: { select: { id: true, name: true } } },
          },
        },
      })
      if (existing) {
        const updated = await db.user.update({
          where: { id: existing.id },
          data: { supabaseAuthId: authUser.id },
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              include: { club: { select: { id: true, name: true } } },
            },
          },
        })
        return shapeAuthUser(updated)
      }

      // Brand new — create
      const name = authUser.user_metadata?.name || authUser.email.split('@')[0]
      const newUser = await db.user.create({
        data: {
          email: authUser.email,
          name,
          role: 'STUDENT',
          supabaseAuthId: authUser.id,
        },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { club: { select: { id: true, name: true } } },
          },
        },
      })
      return shapeAuthUser(newUser)
    }
  } catch (e) {
    // Supabase error — return null
  }

  return null
}

/** Shape a raw Prisma User row into the AuthUser DTO. */
export function shapeAuthUser(user: {
  id: string
  email: string
  name: string
  role: string
  memberships: Array<{
    clubId: string
    role: string
    status: string
    club: { id: string; name: string }
  }>
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    globalRole: user.role,
    memberships: user.memberships.map((m) => ({
      clubId: m.clubId,
      clubName: m.club.name,
      role: m.role,
      status: m.status,
    })),
  }
}

/** Permission matrix — per-club role → allowed actions. */
const PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  SCHOOL_ADMIN: ['*'],
  ADVISOR: ['club:read', 'club:write', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'finance:write', 'announcements:write', 'attendance:write', 'insights:read', 'audit:read'],
  CLUB_LEADER: ['club:read', 'club:write', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'finance:write', 'announcements:write', 'attendance:write', 'insights:read', 'audit:read'],
  PRESIDENT: ['club:read', 'club:write', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'finance:write', 'announcements:write', 'attendance:write'],
  VICE_PRESIDENT: ['club:read', 'club:write', 'members:read', 'members:write', 'events:read', 'events:write', 'finance:read', 'announcements:write', 'attendance:write'],
  TREASURER: ['club:read', 'members:read', 'finance:read', 'finance:write'],
  SECRETARY: ['club:read', 'club:write', 'members:read', 'events:read', 'events:write', 'announcements:write', 'attendance:write'],
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
  if (PERMISSIONS[user.globalRole]?.includes('*')) return true
  if (PERMISSIONS[user.globalRole]?.includes(permission)) return true
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
export async function requireAuth(_req?: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return user
}

/** Guard that also checks a permission. */
export async function requirePermission(
  permission: string,
  clubId?: string
): Promise<AuthUser | NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(user, permission, clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}
