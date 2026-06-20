'use client'

import { useState, useEffect, useRef } from 'react'
import { useFetch, apiPost, apiPatch } from '@/lib/clubhub/hooks'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, ArrowUp, AlertTriangle, Lightbulb, TrendingDown, Clock, PiggyBank, Package, Calendar, Bot } from 'lucide-react'
import { timeAgo } from '@/lib/clubhub/types'
import { toast } from 'sonner'

type Message = {
 role: 'user' | 'assistant'
 content: string
 sources?: { label: string; value: string }[]
 usedLLM?: boolean
 error?: string
 ts: number
}

const SUGGESTED_QUESTIONS = [
 'Who has missed the most meetings in the last 60 days?',
 'How is our budget tracking against what we allocated?',
 'What time of day gets the best attendance?',
 'Are there any items overdue for return?',
 'How many volunteer hours have been approved this semester?',
]

export function AiInsightsTab({ clubId }: { clubId: string }) {
 // ─── Chat state ───
 const [messages, setMessages] = useState<Message[]>([])
 const [input, setInput] = useState('')
 const [sending, setSending] = useState(false)
 const scrollRef = useRef<HTMLDivElement>(null)

 // ─── Insights feed state ───
 const url = clubId !== 'ALL' ? `/api/ai-insights?clubId=${clubId}` : '/api/ai-insights'
 const { data, loading, refetch } = useFetch<{ insights: any[] }>(url)
 const [generating, setGenerating] = useState(false)
 const insights = data?.insights || []

 // Auto-scroll to bottom when messages change
 useEffect(() => {
 if (scrollRef.current) {
 scrollRef.current.scrollTop = scrollRef.current.scrollHeight
 }
 }, [messages, sending])

 async function send(question?: string) {
 const q = (question ?? input).trim()
 if (!q || sending) return
 if (clubId === 'ALL') {
 toast.error('Pick a specific club first — the Assistant works on one club at a time.')
 return
 }

 const history = messages.map((m) => ({ role: m.role, content: m.content }))
 const userMsg: Message = { role: 'user', content: q, ts: Date.now() }
 setMessages((prev) => [...prev, userMsg])
 setInput('')
 setSending(true)

 try {
 const res = await apiPost('/api/assistant', { clubId, question: q, history })
 const assistantMsg: Message = {
 role: 'assistant',
 content: res.answer || '',
 sources: res.sources || [],
 usedLLM: res.usedLLM === true,
 error: res.error,
 ts: Date.now(),
 }
 setMessages((prev) => [...prev, assistantMsg])
 } catch (e: any) {
 setMessages((prev) => [
 ...prev,
 {
 role: 'assistant',
 content: '',
 error: e?.message ?? 'Network error',
 ts: Date.now(),
 },
 ])
 } finally {
 setSending(false)
 }
 }

 async function generateInsights() {
 if (clubId === 'ALL') {
 toast.error('Pick a specific club first.')
 return
 }
 setGenerating(true)
 try {
 const r = await apiPost('/api/ai-insights', { clubId })
 toast.success(`Generated ${r.count} insight(s).`)
 refetch()
 } catch (e: any) {
 toast.error(e.message)
 } finally {
 setGenerating(false)
 }
 }

 async function resolveInsight(id: string) {
 await apiPatch('/api/ai-insights', { id })
 toast.success('Marked as resolved.')
 refetch()
 }

 return (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* ─── Chat (main, 2 cols) ─── */}
 <div className="lg:col-span-2 flex flex-col border border-border" style={{ minHeight: '70vh' }}>
 {/* Header */}
 <div className="px-5 py-4 border-b border-border flex items-baseline justify-between">
 <div>
 <div className="flex items-center gap-2">
 <Bot className="h-4 w-4 text-muted-foreground" />
 <h2 className="text-base font-semibold">Assistant</h2>
 </div>
 <p className="text-xs text-muted-foreground mt-1">
 Ask a question about your club&apos;s data. Answers use real numbers from the database.
 </p>
 </div>
 </div>

 {/* Messages */}
 <div
 ref={scrollRef}
 className="flex-1 overflow-y-auto p-5 space-y-4"
 style={{ minHeight: '300px' }}
 >
 {messages.length === 0 && (
 <div className="h-full flex flex-col items-center justify-center text-center px-6">
 <div className="label-mono mb-3">Suggested questions</div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
 {SUGGESTED_QUESTIONS.map((q) => (
 <button
 key={q}
 onClick={() => send(q)}
 disabled={clubId === 'ALL'}
 className="text-left text-sm border border-border p-3 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {q}
 </button>
 ))}
 </div>
 {clubId === 'ALL' && (
 <p className="mt-5 text-xs text-muted-foreground">
 Pick a specific club above to ask a question.
 </p>
 )}
 </div>
 )}

 {messages.map((m, i) => (
 <MessageBubble key={i} msg={m} />
 ))}

 {sending && (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <RefreshCw className="h-3.5 w-3.5 animate-spin" />
 <span>Asking Gemini…</span>
 </div>
 )}
 </div>

 {/* Input */}
 <div className="border-t border-border p-3">
 <div className="flex items-end gap-2">
 <Textarea
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault()
 send()
 }
 }}
 placeholder={
 clubId === 'ALL'
 ? 'Pick a club first…'
 : 'Ask about attendance, finance, members, events…'
 }
 disabled={clubId === 'ALL' || sending}
 className="min-h-[44px] max-h-32 resize-none field"
 rows={1}
 />
 <Button
 onClick={() => send()}
 disabled={!input.trim() || sending || clubId === 'ALL'}
 size="icon"
 className="h-11 w-11 shrink-0"
 aria-label="Send"
 >
 <ArrowUp className="h-4 w-4" />
 </Button>
 </div>
 <div className="mt-2 flex items-center justify-between label-mono">
 <span>Enter to send · Shift+Enter for newline</span>
 <span>Powered by Gemini 2.0 Flash</span>
 </div>
 </div>
 </div>

 {/* ─── Insights feed (sidebar, 1 col) ─── */}
 <div className="border border-border flex flex-col" style={{ minHeight: '70vh' }}>
 <div className="px-5 py-4 border-b border-border flex items-baseline justify-between">
 <div>
 <h2 className="text-base font-semibold">Insights feed</h2>
 <p className="text-xs text-muted-foreground mt-1">
 Heuristic checks run on your data. Click to resolve.
 </p>
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={generateInsights}
 disabled={generating || clubId === 'ALL'}
 className="shrink-0"
 >
 <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
 Run
 </Button>
 </div>

 <div className="flex-1 overflow-y-auto">
 {loading ? (
 <div className="p-5 space-y-3">
 {[0, 1, 2].map((i) => (
 <Skeleton key={i} className="h-20 w-full" />
 ))}
 </div>
 ) : insights.length === 0 ? (
 <div className="p-5 text-sm text-muted-foreground">
 No active insights. Click <strong>Run</strong> to scan the data.
 </div>
 ) : (
 <ul className="divide-y divide-border">
 {insights.map((i) => (
 <InsightRow key={i.id} insight={i} onResolve={resolveInsight} />
 ))}
 </ul>
 )}
 </div>
 </div>
 </div>
 )
}

/* ───── Sub-components ───── */

function MessageBubble({ msg }: { msg: Message }) {
 if (msg.role === 'user') {
 return (
 <div className="flex justify-end">
 <div className="max-w-[85%] border border-border bg-muted px-4 py-2.5">
 <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
 </div>
 </div>
 )
 }

 // Assistant message
 return (
 <div className="flex justify-start">
 <div className="max-w-[85%] w-full">
 <div className="flex items-center gap-2 mb-1.5">
 <Bot className="h-3.5 w-3.5 text-muted-foreground" />
 <span className="label-mono">Assistant</span>
 {msg.usedLLM === false && msg.error && (
 <span className="label-mono" style={{ color: 'var(--accent-bad)' }}>
 · error
 </span>
 )}
 </div>
 {msg.error ? (
 <div className="border border-border p-4" style={{ color: 'var(--accent-bad)' }}>
 <div className="text-sm mb-1">{msg.error}</div>
 {msg.content && <div className="text-sm text-foreground">{msg.content}</div>}
 </div>
 ) : (
 <div className="border border-border bg-background px-4 py-2.5">
 <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
 </div>
 )}
 {msg.sources && msg.sources.length > 0 && (
 <div className="mt-2 flex flex-wrap gap-2">
 {msg.sources.map((s) => (
 <span key={s.label} className="label-mono border border-border px-1.5 py-0.5">
 {s.label}: {s.value}
 </span>
 ))}
 </div>
 )}
 </div>
 </div>
 )
}

function InsightRow({ insight, onResolve }: { insight: any; onResolve: (id: string) => void }) {
 const sev = (insight.severity || 'info').toLowerCase()
 const sevColor =
 sev === 'critical'
 ? 'var(--accent-bad)'
 : sev === 'warning'
 ? 'var(--accent-warn)'
 : 'var(--accent-good)'
 const Icon = INSIGHT_TYPE_ICONS[insight.type] || AlertTriangle

 return (
 <li className="p-4">
 <div className="flex items-start gap-3">
 <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: sevColor }} />
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium mb-1">{insight.title}</div>
 {insight.body && (
 <p className="text-xs text-muted-foreground leading-relaxed mb-2">{insight.body}</p>
 )}
 {insight.recommendation && (
 <p className="text-xs leading-relaxed mb-2">
 <span className="label-mono mr-1">next</span>
 {insight.recommendation}
 </p>
 )}
 <div className="flex items-center gap-3 label-mono">
 <span style={{ color: sevColor }}>{sev}</span>
 <span>{timeAgo(insight.createdAt)}</span>
 <button
 onClick={() => onResolve(insight.id)}
 className="text-foreground hover:underline"
 >
 resolve →
 </button>
 </div>
 </div>
 </div>
 </li>
 )
}

/* ───── Helpers ───── */

// Static icon lookup map — using a record instead of a switch function
// avoids the React 19 "static-components" lint (functions returning component
// types look like they're creating new components on each render).
const INSIGHT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  AT_RISK_MEMBER: TrendingDown,
  ATTENDANCE_DECLINE: TrendingDown,
  ENGAGEMENT_DROP: TrendingDown,
  BUDGET_WARNING: PiggyBank,
  EQUIPMENT_OVERDUE: Package,
  CAPACITY_WARNING: Calendar,
  RECOMMEND_MEETING_TIME: Calendar,
  SCHEDULING_CONFLICT: Clock,
  RECOMMEND_OUTREACH: Lightbulb,
  TREND_DETECTION: Lightbulb,
}
