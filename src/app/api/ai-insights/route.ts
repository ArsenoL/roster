import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitWebhook } from '@/lib/clubhub/dispatchers'

// GET /api/ai-insights?clubId=...
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const clubId = url.searchParams.get('clubId')
  const includeResolved = url.searchParams.get('includeResolved') === 'true'

  const where: any = {}
  if (clubId && clubId !== 'ALL') where.clubId = clubId
  if (!includeResolved) where.isResolved = false

  const insights = await db.aiInsight.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ insights })
}

/**
 * POST /api/ai-insights — generate fresh insights.
 * Body: { clubId, useLLM?: boolean (default true) }
 *
 * Phase 3 upgrade: we now compute heuristics AND optionally pass the
 * summarized data through the LLM (z-ai-web-dev-sdk) to produce
 * natural-language insights + recommendations.
 *
 * If LLM is unavailable or fails, we fall back to the heuristic-only output.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const clubId = body.clubId
  const useLLM = body.useLLM !== false  // default true

  // Clear old unresolved insights for this club
  await db.aiInsight.deleteMany({ where: { clubId, isResolved: false } })

  // Gather all the data for analysis
  const data = await collectClubData(clubId)
  const heuristicInsights = runHeuristics(clubId, data)

  let llmInsights: any[] = []
  if (useLLM && heuristicInsights.length > 0) {
    try {
      llmInsights = await generateLLMInsights(clubId, data, heuristicInsights)
    } catch (e) {
      console.error('[ai-insights] LLM generation failed, falling back to heuristics', e)
    }
  }

  // Merge: prefer LLM-augmented insights if present, else use heuristics
  const finalInsights = llmInsights.length > 0 ? llmInsights : heuristicInsights

  // Persist
  const created = await Promise.all(
    finalInsights.map((i) => db.aiInsight.create({ data: i }))
  )

  // Fire webhook so external systems can react
  emitWebhook(clubId, 'insight.generated', {
    count: created.length,
    usedLLM: llmInsights.length > 0,
    insights: created.map((i) => ({ id: i.id, type: i.type, severity: i.severity, title: i.title })),
  }).catch(() => {})

  return NextResponse.json({
    insights: created,
    count: created.length,
    usedLLM: llmInsights.length > 0,
  })
}

// ============================================================
// DATA COLLECTION — pull everything the insight engine needs
// ============================================================
async function collectClubData(clubId: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    club, members, events, attendance, transactions, budgets,
    overdueLoans, upcomingEvents, allAttendance,
  ] = await Promise.all([
    db.club.findUnique({ where: { id: clubId }, include: { _count: { select: { members: true, events: true } } } }),
    db.membership.findMany({
      where: { clubId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, grade: true, graduationYear: true,
            attendances: {
              where: { event: { clubId, startTime: { gte: thirtyDaysAgo } } },
              select: { status: true, event: { select: { title: true, startTime: true } } },
            },
          },
        },
      },
    }),
    db.event.findMany({
      where: { clubId },
      include: { _count: { select: { attendances: true } } },
      orderBy: { startTime: 'desc' },
      take: 30,
    }),
    db.attendance.findMany({
      where: { event: { clubId, startTime: { gte: thirtyDaysAgo } } },
      select: { status: true, event: { select: { startTime: true, title: true } } },
    }),
    db.transaction.findMany({ where: { clubId }, orderBy: { date: 'desc' }, take: 30 }),
    db.budget.findMany({ where: { clubId } }),
    db.inventoryLoan.findMany({
      where: { item: { clubId }, status: 'OUT', dueDate: { lt: new Date() } },
      include: { item: { select: { name: true } }, user: { select: { name: true } } },
      take: 10,
    }),
    db.event.findMany({
      where: { clubId, startTime: { gte: new Date() }, status: 'SCHEDULED' },
      include: { _count: { select: { rsvps: true } } },
      take: 10,
    }),
    db.attendance.findMany({
      where: { event: { clubId }, status: { in: ['PRESENT', 'LATE', 'VIRTUAL'] } },
      include: { event: { select: { startTime: true } } },
      take: 500,
    }),
  ])

  // Flatten: move user.attendances → member-level for heuristic compatibility
  const membersFlat = members.map((m) => ({
    ...m,
    attendances: (m.user as any).attendances || [],
  }))

  return {
    club, members: membersFlat, events, attendance, transactions, budgets,
    overdueLoans, upcomingEvents, allAttendance,
  }
}

// ============================================================
// HEURISTIC ENGINE — same 6 rules from Phase 2 (always runs)
// ============================================================
function runHeuristics(clubId: string, data: any): any[] {
  const insights: any[] = []
  const { members, attendance, transactions, budgets, overdueLoans, upcomingEvents, allAttendance } = data

  // 1. AT-RISK MEMBER
  for (const m of members) {
    if (m.attendances.length >= 3) {
      const present = m.attendances.filter((a: any) => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
      const rate = present / m.attendances.length
      if (rate < 0.5) {
        insights.push({
          clubId,
          userId: m.userId,
          type: 'AT_RISK_MEMBER',
          severity: rate < 0.3 ? 'critical' : 'warning',
          title: `${m.user.name} may be at risk of disengaging`,
          body: `Attendance rate over the last 30 days is ${(rate * 100).toFixed(0)}% (${present}/${m.attendances.length} events attended).`,
          recommendation: 'Reach out personally to check in. Consider a 1:1 conversation or assigning them a small task to re-engage.',
          data: JSON.stringify({ rate, present, total: m.attendances.length }),
        })
      }
    }
  }

  // 2. ATTENDANCE DECLINE
  const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const recentAttendance = data.attendance.filter((a: any) => new Date(a.event.startTime) >= twoWeeksAgo && ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
  const priorAttendance = data.attendance.filter((a: any) => {
    const d = new Date(a.event.startTime)
    return d >= fourWeeksAgo && d < twoWeeksAgo && ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)
  }).length

  if (priorAttendance > 0 && recentAttendance < priorAttendance * 0.7) {
    const drop = ((priorAttendance - recentAttendance) / priorAttendance * 100).toFixed(0)
    insights.push({
      clubId,
      type: 'ATTENDANCE_DECLINE',
      severity: 'warning',
      title: `Club attendance dropped ${drop}% in the last 2 weeks`,
      body: `Recent check-ins: ${recentAttendance}, prior 2 weeks: ${priorAttendance}.`,
      recommendation: 'Investigate possible causes: scheduling conflicts, exam period, member burnout. Consider a fun social event to boost morale.',
      data: JSON.stringify({ recentAttendance, priorAttendance }),
    })
  }

  // 3. BUDGET WARNING
  for (const b of budgets) {
    if (b.allocated > 0 && b.spent / b.allocated > 0.8) {
      insights.push({
        clubId,
        type: 'BUDGET_WARNING',
        severity: b.spent / b.allocated > 1 ? 'critical' : 'warning',
        title: `Budget "${b.name}" is ${(b.spent / b.allocated * 100).toFixed(0)}% spent`,
        body: `Allocated: $${b.allocated}, Spent: $${b.spent}.`,
        recommendation: 'Review remaining expenses. Consider a fundraiser or reallocate from another budget category.',
        data: JSON.stringify({ budgetId: b.id, allocated: b.allocated, spent: b.spent }),
      })
    }
  }

  // 4. EQUIPMENT OVERDUE
  if (overdueLoans.length > 0) {
    insights.push({
      clubId,
      type: 'EQUIPMENT_OVERDUE',
      severity: 'warning',
      title: `${overdueLoans.length} item(s) overdue for return`,
      body: overdueLoans.map((l: any) => `${l.item.name} — borrowed by ${l.user.name}, due ${l.dueDate.toLocaleDateString()}`).join('\n'),
      recommendation: 'Send reminders to borrowers. Consider deposits or shorter loan periods going forward.',
      data: JSON.stringify({ loans: overdueLoans.map((l: any) => l.id) }),
    })
  }

  // 5. CAPACITY WARNING
  for (const e of upcomingEvents) {
    if (e.capacity && e._count.rsvps >= e.capacity * 0.9) {
      insights.push({
        clubId,
        type: 'CAPACITY_WARNING',
        severity: e._count.rsvps >= e.capacity ? 'critical' : 'warning',
        title: `"${e.title}" is at ${e._count.rsvps}/${e.capacity} RSVPs`,
        body: `Event on ${e.startTime.toLocaleDateString()} is near or at capacity.`,
        recommendation: 'Consider a larger venue or opening a waitlist. Communicate proactively with members.',
        data: JSON.stringify({ eventId: e.id, rsvps: e._count.rsvps, capacity: e.capacity }),
      })
    }
  }

  // 6. RECOMMEND MEETING TIME
  if (allAttendance.length > 10) {
    const dayHourCount = new Map<string, number>()
    allAttendance.forEach((a: any) => {
      const d = new Date(a.event.startTime)
      const key = `${d.toLocaleDateString('en', { weekday: 'short' })} ${d.getHours()}:00`
      dayHourCount.set(key, (dayHourCount.get(key) || 0) + 1)
    })
    const sorted = Array.from(dayHourCount.entries()).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0 && sorted[0][1] >= 5) {
      const [best, count] = sorted[0]
      insights.push({
        clubId,
        type: 'RECOMMEND_MEETING_TIME',
        severity: 'info',
        title: `Best-attended meeting slot: ${best}`,
        body: `${count} check-ins historically occur at this time.`,
        recommendation: `Schedule important meetings at ${best} for maximum attendance.`,
        data: JSON.stringify({ bestTime: best, count }),
      })
    }
  }

  return insights
}

// ============================================================
// LLM-AUGMENTED INSIGHTS — pass the heuristic findings through
// the LLM to produce richer, more natural-language recommendations
// ============================================================
async function generateLLMInsights(clubId: string, data: any, heuristics: any[]): Promise<any[]> {
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()

  // Build a compact data digest (not the full DB rows) for the LLM
  const digest = {
    club: { name: data.club?.name, memberCount: data.club?._count?.members, eventCount: data.club?._count?.events },
    attendance: {
      last30Days: data.attendance.length,
      presentCount: data.attendance.filter((a: any) => a.status === 'PRESENT').length,
      lateCount: data.attendance.filter((a: any) => a.status === 'LATE').length,
      absentCount: data.attendance.filter((a: any) => a.status === 'ABSENT').length,
    },
    finance: {
      transactions: data.transactions.length,
      recentIncome: data.transactions.filter((t: any) => t.type === 'INCOME').reduce((s: number, t: any) => s + t.amount, 0),
      recentExpenses: data.transactions.filter((t: any) => t.type === 'EXPENSE').reduce((s: number, t: any) => s + t.amount, 0),
      budgetsAtRisk: data.budgets.filter((b: any) => b.allocated > 0 && b.spent / b.allocated > 0.8).length,
    },
    upcomingEvents: data.upcomingEvents.map((e: any) => ({
      title: e.title, capacity: e.capacity, rsvps: e._count.rsvps, startTime: e.startTime,
    })),
    overdueEquipment: data.overdueLoans.length,
    atRiskMembers: data.members.filter((m: any) => {
      if (m.attendances.length < 3) return false
      const present = m.attendances.filter((a: any) => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
      return present / m.attendances.length < 0.5
    }).map((m: any) => ({ name: m.user.name, grade: m.user.grade })),
    heuristicFindings: heuristics.map((h) => ({
      type: h.type, title: h.title, severity: h.severity,
    })),
  }

  const prompt = `You are an expert club advisor AI for high school clubs.
Analyze the following club data and produce 3-7 actionable insights as a JSON array.

Each insight must have:
- "type": one of AT_RISK_MEMBER, ATTENDANCE_DECLINE, ENGAGEMENT_DROP, SCHEDULING_CONFLICT, BUDGET_WARNING, EQUIPMENT_OVERDUE, CAPACITY_WARNING, RECOMMEND_MEETING_TIME, RECOMMEND_OUTREACH, TREND_DETECTION
- "severity": "info" | "warning" | "critical"
- "title": short headline (max 80 chars)
- "body": 1-3 sentences with concrete numbers
- "recommendation": specific actionable next step (1-2 sentences)
- "userId": only set if the insight is about a specific at-risk member (use null otherwise)

Be specific, numerical, and actionable. Avoid generic advice. Use the heuristic findings as a starting point but expand with creative, data-driven observations. Do NOT include markdown or code fences — return raw JSON only.

CLUB DATA:
${JSON.stringify(digest, null, 2)}`

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a precise club-management AI that returns only valid JSON. No prose, no markdown fences.' },
      { role: 'user', content: prompt },
    ],
    thinking: { type: 'disabled' },
  })

  const raw: string = completion?.choices?.[0]?.message?.content || ''

  // Extract JSON array from the response (LLM may add stray text)
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  const parsed = JSON.parse(match[0])

  return parsed.map((i: any) => ({
    clubId,
    userId: null,  // LLM-provided userIds may not exist; rely on title/body to identify members
    type: i.type in InsightTypeEnumMap ? i.type : 'TREND_DETECTION',
    severity: ['info', 'warning', 'critical'].includes(i.severity) ? i.severity : 'info',
    title: String(i.title).slice(0, 200),
    body: String(i.body).slice(0, 2000),
    recommendation: String(i.recommendation || '').slice(0, 2000),
    data: JSON.stringify({ source: 'llm', llmUserId: i.userId, ...digest }),
  }))
}

const InsightTypeEnumMap: Record<string, boolean> = {
  AT_RISK_MEMBER: true,
  ATTENDANCE_DECLINE: true,
  ENGAGEMENT_DROP: true,
  SCHEDULING_CONFLICT: true,
  BUDGET_WARNING: true,
  EQUIPMENT_OVERDUE: true,
  ELECTION_FRAUD_RISK: true,
  RECOMMEND_MEETING_TIME: true,
  RECOMMEND_OUTREACH: true,
  CAPACITY_WARNING: true,
  TREND_DETECTION: true,
}

// Resolve an insight
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const i = await db.aiInsight.update({
    where: { id: body.id },
    data: { isResolved: true, resolvedAt: new Date() },
  })
  return NextResponse.json(i)
}
