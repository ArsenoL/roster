'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiPatch } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, FileText, CheckCircle2, Clock, ClipboardList, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export function MeetingMinutesTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/meeting-minutes?clubId=${clubId}` : '/api/meeting-minutes'
 const { data, loading, refetch } = useFetch<{ minutes: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [editing, setEditing] = useState<any | null>(null)

 const minutes = data?.minutes || []

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Meeting Minutes</h2>
 <p className="text-sm text-muted-foreground">Record what happened — content, decisions, action items, next meeting.</p>
 </div>
 <Button onClick={() => setCreateOpen(true)} disabled={clubId === 'ALL'}><Plus className="h-4 w-4" /> Record minutes</Button>
 </div>

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
 ) : minutes.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No meeting minutes yet. Record your first one after the next meeting.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {minutes.map((m) => (
 <Card key={m.id} className="hover:transition-shadow cursor-pointer" onClick={() => setEditing(m)}>
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div className="flex-1 min-w-[200px]">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-semibold">{m.event?.title || 'Untitled meeting'}</h3>
 {m.isApproved ? (
 <Badge variant="outline" className="text-foreground text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>
 ) : (
 <Badge variant="outline" className="text-foreground text-[10px]"><Clock className="h-3 w-3 mr-1" /> Draft</Badge>
 )}
 </div>
 <div className="text-xs text-muted-foreground mt-1">
 {m.event?.startTime && <span><Calendar className="h-3 w-3 inline mr-1" />{new Date(m.event.startTime).toLocaleString()}</span>}
 </div>
 {m.content && <div className="text-sm text-muted-foreground mt-2 line-clamp-2">{m.content.slice(0, 200)}</div>}
 {(() => {
 try {
 const items = JSON.parse(m.actionItems || '[]')
 if (items.length > 0) {
 return <div className="text-xs text-muted-foreground mt-1"><ClipboardList className="h-3 w-3 inline mr-1" />{items.length} action item(s)</div>
 }
 } catch {}
 return null
 })()}
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <CreateMinutesDialog
 open={createOpen}
 onOpenChange={setCreateOpen}
 clubId={clubId}
 onCreated={() => refetch()}
 />

 {editing && (
 <EditMinutesDialog
 minutes={editing}
 onOpenChange={(o) => !o && setEditing(null)}
 onSaved={() => { setEditing(null); refetch() }}
 />
 )}
 </div>
 )
}

function CreateMinutesDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const { data: eventsData } = useFetch<{ events: any[] }>(`/api/events?clubId=${clubId}&limit=50`)
 const [eventId, setEventId] = useState('')
 const [content, setContent] = useState('')

 const events = (eventsData?.events || []).filter((e: any) => e.status === 'COMPLETED' || e.status === 'IN_PROGRESS')

 async function create() {
 if (!eventId) { toast.error('Pick an event'); return }
 try {
 await apiPost('/api/meeting-minutes', { eventId, clubId, content })
 toast.success('Minutes saved')
 setContent('')
 setEventId('')
 onOpenChange(false)
 onCreated()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Record meeting minutes</DialogTitle>
 <DialogDescription>Pick a past event to record minutes for.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Event</Label>
 <Select value={eventId} onValueChange={setEventId}>
 <SelectTrigger><SelectValue placeholder="Pick an event…" /></SelectTrigger>
 <SelectContent>
 {events.map((e: any) => (
 <SelectItem key={e.id} value={e.id}>{e.title} — {new Date(e.startTime).toLocaleString()}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Initial notes</Label>
 <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Discussion summary, key points…" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={create} disabled={!eventId}>Create draft</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function EditMinutesDialog({ minutes, onOpenChange, onSaved }: any) {
 const [content, setContent] = useState(minutes.content || '')
 const [decisions, setDecisions] = useState<string[]>((() => {
 try { return JSON.parse(minutes.decisions || '[]') } catch { return [] }
 })())
 const [newDecision, setNewDecision] = useState('')
 const [actionItems, setActionItems] = useState<any[]>((() => {
 try { return JSON.parse(minutes.actionItems || '[]') } catch { return [] }
 })())
 const [newAction, setNewAction] = useState({ text: '', assignee: '', due: '' })
 const [nextMeeting, setNextMeeting] = useState(minutes.nextMeeting || '')

 async function save(approve = false) {
 try {
 await apiPatch(`/api/meeting-minutes/${minutes.id}`, {
 content, nextMeeting,
 decisions,
 actionItems,
 ...(approve ? { approve: true } : {}),
 })
 toast.success(approve ? 'Minutes approved' : 'Minutes saved')
 onSaved()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open onOpenChange={onOpenChange}>
 <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{minutes.event?.title}</DialogTitle>
 <DialogDescription>{minutes.event?.startTime && new Date(minutes.event.startTime).toLocaleString()}</DialogDescription>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div>
 <Label>Discussion summary (markdown supported)</Label>
 <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="font-mono text-sm" />
 </div>

 <div>
 <Label>Decisions made</Label>
 <div className="space-y-1 mb-2">
 {decisions.map((d, i) => (
 <div key={i} className="flex items-center gap-2 bg-muted/50 p-2 rounded text-sm">
 <CheckCircle2 className="h-3 w-3 text-foreground shrink-0" />
 <span className="flex-1">{d}</span>
 <Button size="sm" variant="ghost" onClick={() => setDecisions(decisions.filter((_, idx) => idx !== i))}>×</Button>
 </div>
 ))}
 </div>
 <div className="flex gap-2">
 <Input value={newDecision} onChange={(e) => setNewDecision(e.target.value)} placeholder="Add a decision…" onKeyDown={(e) => { if (e.key === 'Enter' && newDecision.trim()) { setDecisions([...decisions, newDecision.trim()]); setNewDecision('') } }} />
 <Button size="sm" variant="outline" onClick={() => { if (newDecision.trim()) { setDecisions([...decisions, newDecision.trim()]); setNewDecision('') } }}>Add</Button>
 </div>
 </div>

 <div>
 <Label>Action items</Label>
 <div className="space-y-1 mb-2">
 {actionItems.map((a, i) => (
 <div key={i} className="flex items-center gap-2 bg-muted/50 p-2 rounded text-sm">
 <ClipboardList className="h-3 w-3 text-foreground shrink-0" />
 <span className="flex-1">{a.text}</span>
 {a.assignee && <Badge variant="outline" className="text-[10px]">{a.assignee}</Badge>}
 {a.due && <Badge variant="outline" className="text-[10px]">{new Date(a.due).toLocaleDateString()}</Badge>}
 <Button size="sm" variant="ghost" onClick={() => setActionItems(actionItems.filter((_, idx) => idx !== i))}>×</Button>
 </div>
 ))}
 </div>
 <div className="grid grid-cols-3 gap-2">
 <Input value={newAction.text} onChange={(e) => setNewAction({ ...newAction, text: e.target.value })} placeholder="Action…" />
 <Input value={newAction.assignee} onChange={(e) => setNewAction({ ...newAction, assignee: e.target.value })} placeholder="Assignee" />
 <Input value={newAction.due} onChange={(e) => setNewAction({ ...newAction, due: e.target.value })} type="date" />
 </div>
 <Button size="sm" variant="outline" className="mt-2" onClick={() => {
 if (newAction.text.trim()) { setActionItems([...actionItems, newAction]); setNewAction({ text: '', assignee: '', due: '' }) }
 }}>Add action item</Button>
 </div>

 <div>
 <Label>Next meeting</Label>
 <Input value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} placeholder="e.g., Tuesday March 5, 3:30 PM in Room 204" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
 <Button variant="secondary" onClick={() => save(false)}>Save draft</Button>
 {!minutes.isApproved && <Button onClick={() => save(true)}>Approve & publish</Button>}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
