/**
 * Shared server-side validation + sanitization helpers.
 */
import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'
import { timingSafeEqual } from 'crypto'

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 500

export function parsePagination(req: NextRequest): { limit: number; offset: number } {
  const url = new URL(req.url)
  const rawLimit = parseInt(url.searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10)
  const rawOffset = parseInt(url.searchParams.get('offset') || '0', 10)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0
  return { limit, offset }
}

export function clampStr(s: string | undefined | null, maxLen: number): string {
  if (!s) return ''
  return String(s).slice(0, maxLen)
}

export const LIMITS = {
  NAME: 200, EMAIL: 254, PHONE: 50, NOTES: 5000, DESCRIPTION: 5000,
  TITLE: 300, BIO: 5000, BODY: 50000, URL: 2000, SUBJECT: 500, QUESTION: 8000,
} as const

export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0') return true
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)]
    if (a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return true
  }
  if (h === '::1' || h === '[::1]') return true
  if (h.endsWith('.local') || h.endsWith('.internal')) return true
  return false
}

export function isSafeCallbackUrl(url: string | undefined | null): boolean {
  if (!isSafeUrl(url)) return false
  try {
    const u = new URL(url!)
    if (u.protocol !== 'https:') return false
    if (process.env.NODE_ENV === 'production' && isPrivateHost(u.hostname)) return false
    return true
  } catch { return false }
}

export function stripNewlines(s: string | undefined | null): string {
  if (!s) return ''
  return String(s).replace(/[\r\n]/g, '')
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function csvSafe(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`
  return s
}

export function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function requireClubWrite(clubId: string) {
  const user = await getCurrentUser()
  if (!user) return { user: null as null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!hasPermission(user, 'club:write', clubId)) return { user: null as null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, response: null as null }
}

export async function isClubMember(userId: string, clubId: string): Promise<boolean> {
  const m = await db.membership.findUnique({ where: { userId_clubId: { userId, clubId } }, select: { status: true } })
  return m?.status === 'ACTIVE'
}

export async function membershipBelongsToClub(membershipId: string, clubId: string): Promise<boolean> {
  const m = await db.membership.findUnique({ where: { id: membershipId }, select: { clubId: true, status: true } })
  return m?.clubId === clubId && m?.status === 'ACTIVE'
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function verifySecretFromHeader(req: NextRequest, headerName: string, expected: string | undefined): boolean {
  if (!expected) return false
  const provided = req.headers.get(headerName)
  if (!provided) return false
  return timingSafeEqualStr(provided, expected)
}
