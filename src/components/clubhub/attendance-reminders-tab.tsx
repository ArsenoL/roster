'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, BellRing, Trash2, Clock, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export function AttendanceRemindersTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/attendance-reminders?clubId=${clubId}` : '/api/attendance-reminders'
 const { data, loading, refetch } = useFetch<{ reminders: any[] }>(url)
 const [bulkOpen, setBulkOpen] = useState(false)

 const reminders = data?.reminders || []
 const pending = reminders.filter(r => !r.sentAt)
 const sent = reminders.filter(r => r.sentAt)

 async function deleteReminder(id: string) {
 try {
 await apiDelete(`/api/attendance-reminders?id=${id}`)
 refetch()
 toast.success('Reminder deleted')
 } catch (e: any) { if (!e?.silent) toast.error(e.message) }
 }

 // Note: the reminder-sender cron endpoint is intentionally NOT exposed
 // to the browser — it must only be triggered by the server scheduler
 // (Vercel Cron / system cron). A client-side "run now" button would let
 // any signed-in user spam the entire club's reminders on demand.

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between flex-wrap gap-2">
 <div>
 <h2 className="text-lg font-semibold">Attendance Reminders</h2>
 <p className="text-sm text-muted-foreground">Schedule pre-event, day-of, and post-event absence reminders.</p>
 </div>
 <div className="flex gap-2">
 <Button onClick={() => setBulkOpen(true)} disabled={clubId === 'ALL'}>
 <BellRing className="h-4 w-4 mr-1" /> Bulk create
 </Button>
 </div>
 </div>

 <div className="grid grid-cols-3 gap-3">
 <Card><CardContent className="p-4">
 <div className="text-2xl font-bold">{reminders.length}</div>
 <div className="text-xs text-muted-foreground">Total scheduled</div>
 </CardContent></Card>
 <Card><CardContent className="p-4">
 <div className="text-2xl font-bold text-foreground">{pending.length}</div>
 <div className="text-xs text-muted-foreground">Pending send</div>
 </CardContent></Card>
 <Card><CardContent className="p-4">
 <div className="text-2xl font-bold text-foreground">{sent.length}</div>
 <div className="text-xs text-muted-foreground">Sent</div>
 </CardContent></Card>
 </div>

 {loading ? (
 <Skeleton className="h-64 w-full" />
 ) : reminders.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No reminders scheduled. Use"Bulk create" to schedule reminders for an event.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {reminders.slice(0, 50).map((r) => (
 <Card key={r.id}>
 <CardContent className="p-3 flex items-center gap-3 flex-wrap">
 <div className="flex-1 min-w-[200px]">
 <div className="font-medium text-sm">{r.event?.title}</div>
 <div className="text-xs text-muted-foreground">{r.user?.name} ({r.user?.email})</div>
 </div>
 <Badge variant="outline" className="text-[10px]">{r.reminderType.replace(/_/g, ' ')}</Badge>
 <Badge variant="outline" className="text-[10px]">{r.channel}</Badge>
 <div className="text-xs text-muted-foreground flex items-center gap-1">
 <Calendar className="h-3 w-3" /> {new Date(r.scheduledFor).toLocaleString()}
 </div>
 {r.sentAt ? (
 <Badge className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[10px]">SENT</Badge>
 ) : (
 <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300">PENDING</Badge>
 )}
 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteReminder(r.id)}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <BulkReminderDialog
 open={bulkOpen}
 onOpenChange={setBulkOpen}
 clubId={clubId}
 onCreated={() => refetch()}
 />
 </div>
 )
}

function BulkReminderDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const { data: eventsData } = useFetch<{ events: any[] }>(`/api/events?clubId=${clubId}&limit=50`)
 const [eventId, setEventId] = useState('')
 const [reminderType, setReminderType] = useState('PRE_EVENT')
 const [offsetMinutes, setOffsetMinutes] = useState('1440')
 const [creating, setCreating] = useState(false)

 const events = (eventsData?.events || []).filter((e: any) => new Date(e.startTime) > new Date())

 async function submit() {
 if (!eventId) { toast.error('Pick an event'); return }
 setCreating(true)
 try {
 const res = await apiPost('/api/attendance-reminders', {
 bulk: true,
 eventId,
 reminderType,
 offsetMinutes: parseInt(offsetMinutes),
 })
 toast.success(`Created ${res.created} reminder(s) for ${res.scheduledFor ? new Date(res.scheduledFor).toLocaleString() : 'now'}`)
 onOpenChange(false); onCreated()
 } catch (e: any) { toast.error(e.message) }
 setCreating(false)
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Schedule reminders for an event</DialogTitle>
 <DialogDescription>Creates reminders for all active members of the club. The reminder-sender cron will deliver them at the scheduled time.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <label className="text-sm font-medium">Event</label>
 <Select value={eventId} onValueChange={setEventId}>
 <SelectTrigger><SelectValue placeholder="Pick an upcoming event…" /></SelectTrigger>
 <SelectContent>
 {events.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No upcoming events</div>}
 {events.map((e: any) => (
 <SelectItem key={e.id} value={e.id}>
 {e.title} — {new Date(e.startTime).toLocaleString()}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <label className="text-sm font-medium">Reminder type</label>
 <Select value={reminderType} onValueChange={setReminderType}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="PRE_EVENT">Pre-event reminder</SelectItem>
 <SelectItem value="DAY_OF">Day-of reminder</SelectItem>
 <SelectItem value="POST_EVENT_ABSENCE">Post-event absence follow-up</SelectItem>
 </SelectContent>
 </Select>
 </div>
 {reminderType !== 'DAY_OF' && (
 <div>
 <label className="text-sm font-medium">Offset (minutes from event time)</label>
 <Select value={offsetMinutes} onValueChange={setOffsetMinutes}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {reminderType === 'PRE_EVENT' ? (
 <>
 <SelectItem value="60">1 hour before</SelectItem>
 <SelectItem value="720">12 hours before</SelectItem>
 <SelectItem value="1440">24 hours before</SelectItem>
 <SelectItem value="2880">2 days before</SelectItem>
 </>
 ) : (
 <>
 <SelectItem value="60">1 hour after</SelectItem>
 <SelectItem value="360">6 hours after</SelectItem>
 <SelectItem value="1440">1 day after</SelectItem>
 </>
 )}
 </SelectContent>
 </Select>
 </div>
 )}
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit} disabled={creating}>{creating ? 'Creating…' : 'Schedule'}</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
