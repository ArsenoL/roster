import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyModule } from '@/lib/clubhub/module-gate'
import { getCurrentUser, hasPermission } from '@/lib/clubhub/auth'

/**
 * Assistant — real Gemini-powered Q&A over club data.
 *
 * POST /api/assistant
 *   body: { clubId: string, question: string, history?: Array<{role:'user'|'assistant', content:string}> }
 *   returns: { answer: string, sources: { label: string, value: string }[], usedLLM: boolean, model?: string, error?: string }
 *
 * Behavior:
 *   - If GEMINI_API_KEY is not set, returns a 200 with `usedLLM: false` and a clear
 *     error message. The heuristic insights feed (separate endpoint) still works.
 *   - Pulls real club data (members, attendance, finance, events) and includes only
 *     the relevant slice in the prompt, based on keywords in the question.
 *   - Calls Gemini 2.0 Flash (free tier) via the REST API.
 *   - On any Gemini error (quota, network, malformed response), returns the error
 *     with `usedLLM: false` so the UI can show a graceful fallback.
 */

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const __gate = await verifyModule(req, 'insights')
  if (__gate instanceof NextResponse) return __gate

  const body = await req.json().catch(() => ({} as any))
  const clubId: string | undefined = body.clubId
  const question: string = (body.question || '').toString().trim()
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(body.history)
    ? body.history.slice(-6) // keep last 3 turns max
    : []

  if (!question) {
    return NextResponse.json({ error: 'No question provided.' }, { status: 400 })
  }
  if (!clubId || clubId === 'ALL') {
    return NextResponse.json(
      { error: 'Pick a specific club first — the Assistant works on one club at a time.' },
      { status: 400 }
    )
  }

  // Assistant Q&A exposes club data — require insights:read (or audit:read /
  // club:read as fallback) on the target club.
  if (!hasPermission(user, 'insights:read', clubId) && !hasPermission(user, 'audit:read', clubId) && !hasPermission(user, 'club:read', clubId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      answer: '',
      sources: [],
      usedLLM: false,
      error:
        'Assistant Q&A is disabled — GEMINI_API_KEY is not set. Add a free key from https://aistudio.google.com/apikey to your .env file. The heuristic insights feed below still works.',
    })
  }

  // 1. Pull real club data, sliced by what the question is about.
  const { clubDigest, sources } = await buildClubDigest(clubId, question)
  if (!clubDigest.club) {
    return NextResponse.json({ error: 'Club not found.' }, { status: 404 })
  }

  // 2. Build the prompt
  const systemPrompt = `You are the Assistant inside Roster, a club-operations tool for high schools.
You answer the club executive's question using ONLY the data provided below.
Rules:
- Be concrete and use real numbers from the data. No hedging, no vague advice.
- If the question is about something not in the data, say "I don't have that data" and explain what data you DO have.
- Never invent member names, dollar amounts, or dates that aren't in the data.
- Keep answers under 200 words. Use short paragraphs or bullets, not walls of text.
- You're talking to a high school club executive, not a CEO. Plain language.

CLUB DATA (JSON):
${JSON.stringify(clubDigest, null, 2)}`

  const userContent = history.length
    ? history.map((m) => `${m.role === 'user' ? 'Exec' : 'Assistant'}: ${m.content}`).join('\n') +
      `\n\nExec: ${question}`
    : question

  // 3. Call Gemini
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 600,
          topP: 0.9,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      let errMessage = `Gemini returned ${res.status}`
      try {
        const errJson = JSON.parse(errText)
        if (errJson?.error?.message) errMessage = `Gemini: ${errJson.error.message}`
      } catch {}

      // Make quota / location errors actionable for the user.
      if (res.status === 429 && errMessage.includes('limit: 0')) {
        errMessage += ' — This deployment\'s IP is in a region where the Gemini free tier has zero quota (e.g. Hong Kong, mainland China, EU). Either deploy Roster in a supported region (US, Japan, etc.), or enable billing on the GCP project tied to the API key.'
      } else if (res.status === 400 && errMessage.includes('User location is not supported')) {
        errMessage += ' — The Gemini free tier is geo-restricted. Deploy Roster in a supported region (US, Japan, etc.) or use a paid Gemini key on a Google Cloud project with billing enabled.'
      }

      return NextResponse.json({
        answer: '',
        sources,
        usedLLM: false,
        error: errMessage,
      })
    }

    const data = await res.json()
    const answer: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('')?.trim() || ''

    if (!answer) {
      return NextResponse.json({
        answer: '',
        sources,
        usedLLM: false,
        error: 'Gemini returned an empty response. Try rephrasing your question.',
      })
    }

    return NextResponse.json({
      answer,
      sources,
      usedLLM: true,
      model: GEMINI_MODEL,
    })
  } catch (e: any) {
    return NextResponse.json({
      answer: '',
      sources,
      usedLLM: false,
      error: `Network error calling Gemini: ${e?.message ?? 'unknown'}`,
    })
  }
}

/* ────────────────────────────────────────────────────────────
 * buildClubDigest — pull real club data, sliced by question topic.
 * We don't send the whole DB to Gemini; we send only what's relevant.
 * ──────────────────────────────────────────────────────────── */
async function buildClubDigest(clubId: string, question: string) {
  const q = question.toLowerCase()
  const want = {
    members: /member|roster|who|join|grade|student|name|alumni|officer|exec/.test(q),
    attendance: /attend|absent|present|late|streak|miss|show up|check-in|rate/.test(q),
    finance: /finance|money|budget|dues|expense|income|spend|cost|balance|fundra/.test(q),
    events: /event|meeting|schedule|calendar|upcoming|next|when|where|rsvp|capacity/.test(q),
    tasks: /task|todo|to-do|deadline|assign|due/.test(q),
    volunteer: /volunteer|hour|service/.test(q),
    inventory: /inventory|equipment|loan|gear|item/.test(q),
  }

  // Always include the club summary (name, counts, meeting schedule).
  const club = await db.club.findUnique({
    where: { id: clubId },
    select: {
      id: true, name: true, description: true, category: true,
      meetingRoom: true, defaultDay: true, defaultTime: true,
      capacity: true, dues: true, _count: { select: { members: true, events: true } },
    },
  })

  const digest: any = {
    club: club
      ? {
          name: club.name,
          description: club.description,
          category: club.category,
          meetingRoom: club.meetingRoom,
          defaultDay: club.defaultDay,
          defaultTime: club.defaultTime,
          capacity: club.capacity,
          dues: club.dues,
          memberCount: club._count.members,
          eventCount: club._count.events,
        }
      : null,
  }

  const sources: { label: string; value: string }[] = []

  if (want.members) {
    const members = await db.membership.findMany({
      where: { clubId, status: 'ACTIVE' },
      include: {
        user: {
          select: { id: true, name: true, grade: true, graduationYear: true },
        },
      },
      take: 100,
      orderBy: { joinedAt: 'asc' },
    })
    digest.members = members.map((m) => ({
      name: m.user.name,
      grade: m.user.grade,
      graduates: m.user.graduationYear,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
    sources.push({ label: 'Members', value: `${members.length} active` })
  }

  if (want.attendance) {
    const since = new Date()
    since.setDate(since.getDate() - 60) // last 60 days
    const [recent, byStatus] = await Promise.all([
      db.attendance.findMany({
        where: { event: { clubId, startTime: { gte: since } } },
        select: { status: true, event: { select: { title: true, startTime: true } } },
        take: 500,
      }),
      db.attendance.groupBy({
        by: ['status'],
        where: { event: { clubId, startTime: { gte: since } } },
        _count: { _all: true },
      }),
    ])
    digest.attendance = {
      last60Days: {
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
        total: recent.length,
      },
      recentMeetings: recent
        .reduce((acc: any[], a) => {
          const key = a.event.title + '|' + a.event.startTime.toISOString()
          const existing = acc.find((x) => x.key === key)
          if (existing) existing.count++
          else acc.push({ key, title: a.event.title, date: a.event.startTime, count: 1 })
          return acc
        }, [])
        .slice(-10),
    }
    sources.push({ label: 'Attendance', value: `${recent.length} records (60d)` })
  }

  if (want.finance) {
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const [transactions, budgets] = await Promise.all([
      db.transaction.findMany({
        where: { clubId, date: { gte: since } },
        select: { type: true, amount: true, description: true, date: true, category: true },
        take: 100,
        orderBy: { date: 'desc' },
      }),
      db.budget.findMany({ where: { clubId }, select: { name: true, allocated: true, spent: true } }),
    ])
    const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    const expenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)
    digest.finance = {
      last90Days: { income, expenses, net: income - expenses, transactionCount: transactions.length },
      budgets: budgets.map((b) => ({
        name: b.name,
        allocated: b.allocated,
        spent: b.spent,
        percentUsed: b.allocated > 0 ? Math.round((b.spent / b.allocated) * 100) : 0,
      })),
    }
    sources.push({ label: 'Finance', value: `${transactions.length} txns (90d)` })
  }

  if (want.events) {
    const now = new Date()
    const [upcoming, recent] = await Promise.all([
      db.event.findMany({
        where: { clubId, startTime: { gte: now } },
        select: { id: true, title: true, startTime: true, location: true, capacity: true, type: true, _count: { select: { rsvps: true } } },
        take: 10,
        orderBy: { startTime: 'asc' },
      }),
      db.event.findMany({
        where: { clubId, startTime: { lt: now } },
        select: { id: true, title: true, startTime: true, _count: { select: { attendances: true } } },
        take: 5,
        orderBy: { startTime: 'desc' },
      }),
    ])
    digest.events = {
      upcoming: upcoming.map((e) => ({
        title: e.title, type: e.type, startsAt: e.startTime, location: e.location,
        capacity: e.capacity, rsvps: e._count.rsvps,
      })),
      recentMeetings: recent.map((e) => ({
        title: e.title, startedAt: e.startTime, attendanceCount: e._count.attendances,
      })),
    }
    sources.push({ label: 'Events', value: `${upcoming.length} upcoming` })
  }

  if (want.tasks) {
    const tasks = await db.task.findMany({
      where: { clubId },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { name: true } } },
      take: 30,
      orderBy: { createdAt: 'desc' },
    })
    digest.tasks = tasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      due: t.dueDate,
      assignee: t.assignee?.name ?? null,
    }))
    sources.push({ label: 'Tasks', value: `${tasks.length} total` })
  }

  if (want.volunteer) {
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const hours = await db.volunteerHours.findMany({
      where: { clubId, date: { gte: since } },
      select: { hours: true, status: true, description: true, date: true, user: { select: { name: true } } },
      take: 50,
      orderBy: { date: 'desc' },
    })
    const approved = hours.filter((h) => h.status === 'APPROVED').reduce((s, h) => s + h.hours, 0)
    digest.volunteer = {
      last90Days: {
        totalHours: hours.reduce((s, h) => s + h.hours, 0),
        approvedHours: approved,
        pendingHours: hours.filter((h) => h.status === 'PENDING').reduce((s, h) => s + h.hours, 0),
        entries: hours.length,
      },
    }
    sources.push({ label: 'Volunteer', value: `${approved}h approved (90d)` })
  }

  if (want.inventory) {
    const [items, overdueLoans] = await Promise.all([
      db.inventoryItem.findMany({
        where: { clubId },
        select: { name: true, condition: true, quantity: true, quantityAvailable: true },
        take: 50,
      }),
      db.inventoryLoan.findMany({
        where: { item: { clubId }, status: 'OUT', dueDate: { lt: new Date() } },
        select: { item: { select: { name: true } }, user: { select: { name: true } }, dueDate: true },
        take: 20,
      }),
    ])
    digest.inventory = {
      items: items.length,
      conditions: items.reduce((acc: any, i) => {
        acc[i.condition] = (acc[i.condition] || 0) + 1
        return acc
      }, {}),
      overdueLoans: overdueLoans.map((l) => ({
        item: l.item.name, borrower: l.user.name, due: l.dueDate,
      })),
    }
    sources.push({ label: 'Inventory', value: `${items.length} items` })
  }

  // If nothing matched, send the basic club summary only.
  return { clubDigest: digest, sources }
}
