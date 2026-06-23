'use client'

import { useState, useMemo } from 'react'
import { useFetch, apiPost, apiPut, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
 Calendar, Plus, Clock, MapPin, Users, Trash2, Pencil, Filter, CalendarDays, List, Repeat, QrCode
} from 'lucide-react'
import { EVENT_TYPES, eventTypeEmoji, eventTypeLabel, formatDate, formatTime, formatDateTime, type ClubEvent } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function EventsTab({ clubId }: { clubId: string }) {
 const [view, setView] = useState<'upcoming' | 'past'>('upcoming')
 const [typeFilter, setTypeFilter] = useState('ALL')
 const [createOpen, setCreateOpen] = useState(false)

 const url = useMemo(() => {
 const now = new Date().toISOString()
 const from = view === 'upcoming' ? now : undefined
 const to = view === 'past' ? now : undefined
 return `/api/events?${clubId !== 'ALL' ? `clubId=${clubId}&` : ''}${from ? `from=${encodeURIComponent(from)}&` : ''}${to ? `to=${encodeURIComponent(to)}&` : ''}${typeFilter !== 'ALL' ? `type=${typeFilter}` : ''}`
 }, [clubId, view, typeFilter])
 const { data, loading, refetch } = useFetch<{ events: ClubEvent[] }>(url)

 const events = data?.events || []

 return (
 <div className="space-y-4">
 <div className="flex flex-wrap items-center gap-3 justify-between">
 <Tabs value={view} onValueChange={(v) => setView(v as any)}>
 <TabsList>
 <TabsTrigger value="upcoming"><Calendar className="h-3.5 w-3.5 mr-1" /> Upcoming</TabsTrigger>
 <TabsTrigger value="past"><CalendarDays className="h-3.5 w-3.5 mr-1" /> Past</TabsTrigger>
 </TabsList>
 </Tabs>
 <div className="flex items-center gap-3">
 <Select value={typeFilter} onValueChange={setTypeFilter}>
 <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Types</SelectItem>
 {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Button onClick={() => setCreateOpen(true)}>
 <Plus className="h-4 w-4" /> New Event
 </Button>
 </div>
 </div>

 {loading ? (
 <div className="space-y-3">
 {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
 </div>
 ) : events.length === 0 ? (
 <Card>
 <CardContent className="py-16 text-center text-muted-foreground">
 <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>No {view} events. {view === 'upcoming' && 'Create one to get started.'}</p>
 </CardContent>
 </Card>
 ) : (
 <div className="space-y-3">
 {events.map(e => (
 <EventCard key={e.id} event={e} onDeleted={() => refetch()} showClub={clubId === 'ALL'} />
 ))}
 </div>
 )}

 <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => refetch()} />
 </div>
 )
}

function EventCard({ event, onDeleted, showClub = false }: { event: ClubEvent, onDeleted: () => void, showClub?: boolean }) {
 const stats = event.attendanceStats || {}
 const total = Object.values(stats).reduce((a, b) => a + b, 0)
 const present = (stats.PRESENT || 0) + (stats.LATE || 0) + (stats.VIRTUAL || 0)
 const rate = total > 0 ? Math.round((present / total) * 100) : 0

 const start = new Date(event.startTime)
 const end = new Date(event.endTime)
 const isPast = start < new Date()

 // Parse kiosk code from metadata (if set)
 const kioskCode = (() => {
 try {
 const m = JSON.parse((event as any).metadata || '{}')
 return m.kioskCode || null
 } catch { return null }
 })()

 async function generateKioskCode() {
 try {
 const d = await apiPut('/api/kiosk', { eventId: event.id })
 if (d.code) {
 toast.success(`Kiosk code: ${d.code}`)
 onDeleted() // refetch
 }
 } catch (e: any) { if (!e?.silent) toast.error(e.message) }
 }

 async function openKiosk() {
 if (!kioskCode) {
 await generateKioskCode()
 return
 }
 window.open(`/kiosk`, '_blank')
 }

 return (
 <Card className="hover:transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-start gap-4">
 <div
 className="flex flex-col items-center justify-center min-w-[4rem] h-16 rounded-lg text-white font-bold shrink-0"
 style={{ backgroundColor: event.club?.primaryColor || '#6366f1' }}
 >
 <span className="text-[10px] uppercase opacity-90">{start.toLocaleDateString('en-US', { month: 'short' })}</span>
 <span className="text-xl leading-none">{start.getDate()}</span>
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-lg">{eventTypeEmoji(event.type)}</span>
 <h3 className="font-semibold truncate">{event.title}</h3>
 {event.isRecurring && (
 <Badge variant="outline" className="text-[10px]"><Repeat className="h-2.5 w-2.5 mr-0.5" />Recurring</Badge>
 )}
 {event.isRequired && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
 <Badge
 variant="outline"
 className="text-[10px]"
 style={{
 backgroundColor: event.status === 'COMPLETED' ? '#10b98120' :
 event.status === 'CANCELLED' ? '#ef444420' :
 event.status === 'IN_PROGRESS' ? '#f59e0b20' : '#6366f120',
 color: event.status === 'COMPLETED' ? '#10b981' :
 event.status === 'CANCELLED' ? '#ef4444' :
 event.status === 'IN_PROGRESS' ? '#f59e0b' : '#6366f1'
 }}
 >
 {event.status.replace(/_/g, ' ').toLowerCase()}
 </Badge>
 </div>
 {event.description && (
 <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
 )}
 <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
 <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(start)} – {formatTime(end)}</span>
 {event.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>}
 {event.capacity && <span className="flex items-center gap-1"><Users className="h-3 w-3" />cap {event.capacity}</span>}
 {event.club?.name && showClub && (
 <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: `${event.club.primaryColor}20` }}>
 {event.club.name}
 </Badge>
 )}
 </div>
 </div>
 <div className="text-right shrink-0">
 {isPast && total > 0 ? (
 <>
 <div className="text-2xl font-bold" style={{ color: rate > 75 ? '#10b981' : rate > 50 ? '#f59e0b' : '#ef4444' }}>
 {rate}%
 </div>
 <div className="text-xs text-muted-foreground">{present}/{total} attended</div>
 </>
 ) : (
 <div className="text-xs text-muted-foreground">
 {formatDate(start, { weekday: 'short' })}
 </div>
 )}
 </div>
 </div>

 {isPast && total > 0 && (
 <div className="mt-3 flex flex-wrap gap-2">
 {Object.entries(stats).map(([status, count]) => (
 count > 0 && (
 <Badge key={status} variant="outline" className="text-[10px]">
 {status.replace(/_/g, ' ').toLowerCase()}: {count}
 </Badge>
 )
 ))}
 </div>
 )}
 </div>

 <div className="flex flex-col gap-1 shrink-0">
 {!isPast && (
 <Button
 size="sm"
 variant={kioskCode ? 'default' : 'outline'}
 className="h-7 text-[10px] gap-1"
 onClick={openKiosk}
 title={kioskCode ? `Kiosk code: ${kioskCode} — click to open kiosk` : 'Generate kiosk code'}
 >
 <QrCode className="h-3 w-3" />
 {kioskCode || 'Kiosk'}
 </Button>
 )}
 <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
 if (!confirm(`Delete"${event.title}"?`)) return
 try {
 await apiDelete(`/api/events/${event.id}`)
 toast.success('Event deleted')
 onDeleted()
 } catch (e: any) { toast.error(e.message) }
 }}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 )
}

function CreateEventDialog({ open, onOpenChange, clubId, onCreated }: {
 open: boolean
 onOpenChange: (o: boolean) => void
 clubId: string
 onCreated: () => void
}) {
 // Default start date to tomorrow, end date to tomorrow — so the form is
 // submittable without the user having to manually pick a date in the
 // native date picker (which is hard for browser automation and
 // keyboard-only users).
 const tomorrow = new Date()
 tomorrow.setDate(tomorrow.getDate() + 1)
 const tomorrowStr = tomorrow.toISOString().split('T')[0]

 const [form, setForm] = useState({
 title: '',
 description: '',
 type: 'MEETING',
 startDate: tomorrowStr,
 startTime: '15:30',
 endDate: tomorrowStr,
 endTime: '17:00',
 location: '',
 capacity: 50,
 isRequired: false,
 recurrence: 'none',
 recurrenceCount: 12,
 })

 const handleSubmit = async () => {
 if (!form.title || !form.startDate) {
 toast.error('Title and start date are required')
 return
 }
 try {
 const startTime = new Date(`${form.startDate}T${form.startTime}`)
 const endTime = new Date(`${form.endDate || form.startDate}T${form.endTime}`)
 await apiPost('/api/events', {
 clubId,
 title: form.title,
 description: form.description,
 type: form.type,
 startTime: startTime.toISOString(),
 endTime: endTime.toISOString(),
 location: form.location,
 capacity: parseInt(String(form.capacity)) || null,
 isRequired: form.isRequired,
 recurrence: form.recurrence,
 recurrenceCount: parseInt(String(form.recurrenceCount)) || 12,
 status: 'SCHEDULED',
 })
 toast.success(form.recurrence !== 'none' ? `Created ${form.recurrenceCount} recurring events` : 'Event created')
 setForm({ title: '', description: '', type: 'MEETING', startDate: tomorrowStr, startTime: '15:30', endDate: tomorrowStr, endTime: '17:00', location: '', capacity: 50, isRequired: false, recurrence: 'none', recurrenceCount: 12 })
 onOpenChange(false)
 onCreated()
 } catch (e: any) {
 toast.error(e.message)
 }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Create New Event</DialogTitle>
 <DialogDescription>Schedule a meeting, practice, competition, fundraiser, or any other club event.</DialogDescription>
 </DialogHeader>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
 <div className="md:col-span-2">
 <Label>Event Title *</Label>
 <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Weekly Meeting #5" />
 </div>
 <div className="md:col-span-2">
 <Label>Description</Label>
 <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
 </div>
 <div>
 <Label>Type</Label>
 <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Capacity</Label>
 <Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
 </div>
 <div>
 <Label>Start Date *</Label>
 <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
 </div>
 <div>
 <Label>Start Time</Label>
 <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
 </div>
 <div>
 <Label>End Date (defaults to start)</Label>
 <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
 </div>
 <div>
 <Label>End Time</Label>
 <Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
 </div>
 <div className="md:col-span-2">
 <Label>Location</Label>
 <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g., Room 204" />
 </div>
 <div>
 <Label>Recurrence</Label>
 <Select value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">No recurrence</SelectItem>
 <SelectItem value="daily">Daily</SelectItem>
 <SelectItem value="weekly">Weekly</SelectItem>
 <SelectItem value="biweekly">Bi-weekly</SelectItem>
 <SelectItem value="monthly">Monthly</SelectItem>
 </SelectContent>
 </Select>
 </div>
 {form.recurrence !== 'none' && (
 <div>
 <Label>Number of occurrences</Label>
 <Input type="number" value={form.recurrenceCount} onChange={e => setForm({ ...form, recurrenceCount: parseInt(e.target.value) || 1 })} />
 </div>
 )}
 <div className="md:col-span-2 flex items-center gap-2 pt-2">
 <Switch checked={form.isRequired} onCheckedChange={v => setForm({ ...form, isRequired: v })} id="required" />
 <Label htmlFor="required">Required attendance (members must attend)</Label>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={handleSubmit}>Create Event</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
