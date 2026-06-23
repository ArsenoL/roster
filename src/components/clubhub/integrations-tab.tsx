'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiPatch, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Webhook, Send, Trash2, Zap, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

const WEBHOOK_EVENTS = [
 { value: 'announcement.created', label: 'Announcement posted' },
 { value: 'event.created', label: 'Event created' },
 { value: 'event.updated', label: 'Event updated' },
 { value: 'event.cancelled', label: 'Event cancelled' },
 { value: 'attendance.checked_in', label: 'Attendance check-in' },
 { value: 'rsvp.created', label: 'RSVP created' },
 { value: 'rsvp.cancelled', label: 'RSVP cancelled' },
 { value: 'member.joined', label: 'Member joined' },
 { value: 'member.left', label: 'Member left' },
 { value: 'task.assigned', label: 'Task assigned' },
 { value: 'task.completed', label: 'Task completed' },
 { value: 'poll.created', label: 'Poll created' },
 { value: 'poll.closed', label: 'Poll closed' },
 { value: 'form.submitted', label: 'Form submitted' },
 { value: 'badge.awarded', label: 'Badge awarded' },
 { value: 'budget.warning', label: 'Budget warning' },
 { value: 'application.submitted', label: 'Application submitted' },
 { value: 'application.accepted', label: 'Application accepted' },
 { value: 'inventory.loaned', label: 'Item loaned' },
 { value: 'inventory.returned', label: 'Item returned' },
 { value: 'inventory.overdue', label: 'Item overdue' },
 { value: 'insight.generated', label: 'AI insight generated' },
]

export function IntegrationsTab({ clubId }: { clubId: string }) {
 return (
 <div className="space-y-4">
 <div>
 <h2 className="text-lg font-semibold">Integrations & Webhooks</h2>
 <p className="text-sm text-muted-foreground">Send real-time events to external systems — Slack, Discord, Zapier, Make, custom scripts.</p>
 </div>

 <Tabs defaultValue="webhooks">
 <TabsList>
 <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-2" /> Webhooks</TabsTrigger>
 <TabsTrigger value="email-templates"><Send className="h-4 w-4 mr-2" /> Email Templates</TabsTrigger>
 <TabsTrigger value="api-keys"><Zap className="h-4 w-4 mr-2" /> API Keys</TabsTrigger>
 <TabsTrigger value="email-logs"><Clock className="h-4 w-4 mr-2" /> Email Logs</TabsTrigger>
 </TabsList>

 <TabsContent value="webhooks" className="mt-4"><WebhooksPanel clubId={clubId} /></TabsContent>
 <TabsContent value="email-templates" className="mt-4"><EmailTemplatesPanel clubId={clubId} /></TabsContent>
 <TabsContent value="api-keys" className="mt-4"><ApiKeysPanel clubId={clubId} /></TabsContent>
 <TabsContent value="email-logs" className="mt-4"><EmailLogsPanel clubId={clubId} /></TabsContent>
 </Tabs>
 </div>
 )
}

function WebhooksPanel({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/webhooks?clubId=${clubId}` : '/api/webhooks'
 const { data, loading, refetch } = useFetch<{ webhooks: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [form, setForm] = useState({ name: '', url: '', events: [] as string[] })

 const webhooks = data?.webhooks || []

 async function create() {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 try {
 await apiPost('/api/webhooks', { ...form, clubId })
 toast.success('Webhook created — secret shown once')
 setForm({ name: '', url: '', events: [] })
 setCreateOpen(false)
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 async function test(id: string) {
 try {
 const res = await fetch(`/api/webhooks/test?id=${id}`, { method: 'POST' })
 const data = await res.json()
 if (data.ok) {
 toast.success(`Ping sent in ${data.durationMs}ms — HTTP ${data.lastResponseStatus}`)
 } else {
 toast.error('Ping failed')
 }
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 async function remove(id: string) {
 try {
 await apiDelete(`/api/webhooks/${id}`)
 toast.success('Webhook removed')
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 async function toggle(id: string, active: boolean) {
 try {
 await apiPatch(`/api/webhooks/${id}`, { isActive: !active })
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <>
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">{webhooks.length} webhook(s) registered</p>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4" /> Add webhook</Button>
 </div>

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
 ) : webhooks.length === 0 ? (
 <Card><CardContent className="py-12 text-center text-muted-foreground">
 <Webhook className="h-10 w-10 mx-auto mb-3 opacity-30" />
 No webhooks yet. Register an endpoint to start receiving real-time events.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {webhooks.map((w) => (
 <Card key={w.id}>
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div className="flex-1 min-w-[200px]">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-semibold">{w.name}</h3>
 <Badge variant={w.isActive ? 'default' : 'secondary'}>
 {w.isActive ? 'Active' : 'Paused'}
 </Badge>
 {w.lastResponseStatus && (
 <Badge variant="outline" className={w.lastResponseStatus >= 200 && w.lastResponseStatus < 300 ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300'}>
 HTTP {w.lastResponseStatus}
 </Badge>
 )}
 </div>
 <div className="text-xs text-muted-foreground mt-1 font-mono truncate">{w.url}</div>
 {w.lastTriggeredAt && (
 <div className="text-xs text-muted-foreground mt-1">Last fired: {new Date(w.lastTriggeredAt).toLocaleString()}</div>
 )}
 <div className="flex flex-wrap gap-1 mt-2">
 {(() => {
 try {
 const evs = JSON.parse(w.events || '[]')
 return (evs.length === 0 ? ['all events'] : evs).map((e: string) => (
 <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>
 ))
 } catch { return null }
 })()}
 </div>
 </div>
 <div className="flex gap-2">
 <Button size="sm" variant="outline" onClick={() => test(w.id)}><Zap className="h-3 w-3 mr-1" /> Test</Button>
 <Button size="sm" variant="outline" onClick={() => toggle(w.id, w.isActive)}>{w.isActive ? 'Pause' : 'Resume'}</Button>
 <Button size="sm" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="h-3 w-3 text-foreground" /></Button>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <Dialog open={createOpen} onOpenChange={setCreateOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>New Webhook</DialogTitle>
 <DialogDescription>Register an endpoint to receive HTTP POST requests when events happen.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Name</Label>
 <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Slack #general notifications" />
 </div>
 <div>
 <Label>Endpoint URL</Label>
 <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook" />
 </div>
 <div>
 <Label>Events to subscribe to</Label>
 <p className="text-xs text-muted-foreground mb-2">Leave empty to receive all events.</p>
 <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
 {WEBHOOK_EVENTS.map((e) => (
 <label key={e.value} className="flex items-center gap-2 text-sm cursor-pointer">
 <input
 type="checkbox"
 checked={form.events.includes(e.value)}
 onChange={(ev) => {
 if (ev.target.checked) setForm({ ...form, events: [...form.events, e.value] })
 else setForm({ ...form, events: form.events.filter((x) => x !== e.value) })
 }}
 />
 {e.label}
 </label>
 ))}
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
 <Button onClick={create} disabled={!form.name || !form.url}>Create webhook</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}

function EmailTemplatesPanel({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/email/templates?clubId=${clubId}` : '/api/email/templates'
 const { data, loading, refetch } = useFetch<{ templates: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [form, setForm] = useState({ name: '', subject: '', body: '', type: 'custom' })

 const templates = data?.templates || []

 async function create() {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 try {
 await apiPost('/api/email/templates', { ...form, clubId })
 toast.success('Template saved')
 setForm({ name: '', subject: '', body: '', type: 'custom' })
 setCreateOpen(false)
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <>
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">Reusable email templates with merge fields ({'<code>{{name}}</code>'} etc.)</p>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4" /> New template</Button>
 </div>

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
 ) : templates.length === 0 ? (
 <Card><CardContent className="py-12 text-center text-muted-foreground">
 <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
 No email templates yet.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {templates.map((t) => (
 <Card key={t.id}>
 <CardContent className="p-4">
 <div className="flex items-center justify-between gap-2">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-semibold">{t.name}</h3>
 <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
 </div>
 <div className="text-sm text-muted-foreground mt-1">Subject: {t.subject}</div>
 <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body.replace(/<[^>]+>/g, '').slice(0, 200)}</div>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <Dialog open={createOpen} onOpenChange={setCreateOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>New Email Template</DialogTitle>
 <DialogDescription>Use merge fields like {'{{name}}'}, {'{{club_name}}'}, {'{{event_title}}'} — they'll be replaced at send time.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Template name</Label>
 <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Welcome email" />
 </div>
 <div>
 <Label>Type</Label>
 <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="welcome">Welcome</SelectItem>
 <SelectItem value="reminder">Reminder</SelectItem>
 <SelectItem value="digest">Digest</SelectItem>
 <SelectItem value="custom">Custom</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Subject</Label>
 <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Welcome to {{club_name}}, {{name}}!" />
 </div>
 <div>
 <Label>Body (HTML)</Label>
 <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} placeholder="<h2>Hi {{name}}</h2><p>Welcome to {{club_name}}!</p>" className="font-mono text-xs" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
 <Button onClick={create} disabled={!form.name || !form.subject}>Save template</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}

function ApiKeysPanel({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/api-keys?clubId=${clubId}` : '/api/api-keys'
 const { data, loading, refetch } = useFetch<{ apiKeys: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [newKey, setNewKey] = useState<string | null>(null)
 const [form, setForm] = useState({ name: '' })

 const keys = data?.apiKeys || []

 async function create() {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 try {
 const res = await apiPost('/api/api-keys', { ...form, clubId, scopes: ['read', 'write'] })
 setNewKey(res.apiKey.key)
 setCreateOpen(false)
 setForm({ name: '' })
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 async function remove(id: string) {
 try {
 await apiDelete(`/api/api-keys/${id}`)
 toast.success('API key revoked')
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <>
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">Programmatic API access for scripts, automations, and external apps.</p>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4" /> Generate key</Button>
 </div>

 {newKey && (
 <Card className="border-amber-300 bg-foreground dark:bg-amber-950/30">
 <CardContent className="p-4">
 <div className="flex items-center gap-2 mb-2">
 <CheckCircle2 className="h-4 w-4 text-foreground" />
 <span className="font-semibold">Copy your API key now — it won't be shown again.</span>
 </div>
 <code className="text-xs break-all block bg-white dark:bg-black/40 p-2 rounded font-mono">{newKey}</code>
 <Button size="sm" className="mt-2" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied to clipboard') }}>Copy</Button>
 </CardContent>
 </Card>
 )}

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
 ) : keys.length === 0 ? (
 <Card><CardContent className="py-12 text-center text-muted-foreground">
 <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
 No API keys yet.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {keys.map((k) => (
 <Card key={k.id}>
 <CardContent className="p-4 flex items-center justify-between">
 <div>
 <div className="font-semibold">{k.name}</div>
 <div className="text-xs text-muted-foreground font-mono">{k.prefix}…</div>
 <div className="text-xs text-muted-foreground mt-1">
 {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}` : 'Never used'}
 {k.expiresAt && ` · expires ${new Date(k.expiresAt).toLocaleDateString()}`}
 </div>
 </div>
 <Button size="sm" variant="ghost" onClick={() => remove(k.id)}><Trash2 className="h-3 w-3 text-foreground" /></Button>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <Dialog open={createOpen} onOpenChange={setCreateOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Generate API key</DialogTitle>
 <DialogDescription>The key will be shown only once. Store it securely.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Key name</Label>
 <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Slack sync bot" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
 <Button onClick={create} disabled={!form.name}>Generate key</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 )
}

function EmailLogsPanel({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/email/logs?clubId=${clubId}` : '/api/email/logs'
 const { data, loading } = useFetch<{ logs: any[] }>(url)

 const logs = data?.logs || []

 return (
 <>
 <p className="text-sm text-muted-foreground">Recent email delivery attempts.</p>
 {loading ? (
 <Skeleton className="h-64 w-full" />
 ) : logs.length === 0 ? (
 <Card><CardContent className="py-12 text-center text-muted-foreground">No emails sent yet.</CardContent></Card>
 ) : (
 <Card>
 <CardContent className="p-0">
 <div className="divide-y">
 {logs.map((l) => (
 <div key={l.id} className="p-3 flex items-center gap-3 text-sm">
 {l.status === 'SENT' ? <CheckCircle2 className="h-4 w-4 text-foreground" /> : <XCircle className="h-4 w-4 text-foreground" />}
 <div className="flex-1 min-w-0">
 <div className="font-medium truncate">{l.subject}</div>
 <div className="text-xs text-muted-foreground">{l.toEmail}</div>
 </div>
 <div className="text-xs text-muted-foreground">{new Date(l.sentAt).toLocaleString()}</div>
 {l.error && <Badge variant="outline" className="text-foreground text-[10px]">{l.error.slice(0, 40)}</Badge>}
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </>
 )
}
