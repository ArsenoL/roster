// Server-side module gate — two flavors:
//
// 1. verifyModule(req, moduleId): call at the top of an API route.
//    Returns `{ club, clubId }` on success, or a NextResponse (403/404/400)
//    to return immediately on failure.
//
//    export async function GET(req: NextRequest) {
//      const gate = await verifyModule(req, 'finance')
//      if (gate instanceof NextResponse) return gate
//      const { clubId, club } = gate
//      // ... route logic
//    }
//
// 2. withModuleGate(moduleId, handler): higher-order wrapper for routes
//    where you want the club lookup fully abstracted.
//
// Behavior:
// - Resolves the club from query string `clubId`, body `clubId`, or
//   route params (ctx.params.clubId / ctx.params.id — caller must pass).
// - If the club doesn't exist → 404.
// - If the module is not enabled → 403 with a clear error message.
// - Legacy clubs (modules === null) → all modules on, request proceeds.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isModuleEnabled, type ModuleId } from '@/lib/clubhub/modules'

export interface ModuleGateSuccess {
  club: NonNullable<Awaited<ReturnType<typeof db.club.findUnique>>>
  clubId: string
}

export type ModuleGateResult = ModuleGateSuccess | NextResponse

// Resolve clubId from request: query string, body (POST/PUT/PATCH), or params.
async function resolveClubId(req: NextRequest, params?: Record<string, string>): Promise<string | undefined> {
  // Route params (highest priority — explicit)
  if (params?.clubId) return params.clubId
  if (params?.id) return params.id

  // Query string
  const url = new URL(req.url)
  const queryClubId = url.searchParams.get('clubId')
  if (queryClubId) return queryClubId

  // Body (for POST/PUT/PATCH)
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    try {
      const cloned = req.clone()
      const body = await cloned.json().catch(() => ({}))
      if (body?.clubId) return body.clubId
    } catch {}
  }

  return undefined
}

export async function verifyModule(
  req: NextRequest,
  moduleId: ModuleId,
  params?: Record<string, string>
): Promise<ModuleGateResult> {
  const clubId = await resolveClubId(req, params)

  if (!clubId) {
    return NextResponse.json(
      { error: 'clubId is required to check module access.' },
      { status: 400 }
    )
  }

  const club = await db.club.findUnique({ where: { id: clubId } })
  if (!club) {
    return NextResponse.json(
      { error: 'Club not found.' },
      { status: 404 }
    )
  }

  if (!isModuleEnabled(club.modules, moduleId)) {
    return NextResponse.json(
      {
        error: `The "${moduleId}" module is not enabled for this club. An exec can enable it from Settings → Modules.`,
        moduleId,
        clubId,
      },
      { status: 403 }
    )
  }

  return { club, clubId }
}

// Higher-order wrapper for routes that want the club lookup fully abstracted.
export function withModuleGate<T>(
  moduleId: ModuleId,
  handler: (req: NextRequest, ctx: ModuleGateSuccess) => Promise<T | NextResponse>
) {
  return async (req: NextRequest, ctx: { params?: Record<string, string> } = {}): Promise<T | NextResponse> => {
    const gate = await verifyModule(req, moduleId, ctx.params)
    if (gate instanceof NextResponse) return gate
    return handler(req, gate)
  }
}
