'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiPatch } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Building2, Plus, Calendar, MapPin, Clock, CheckCircle, XCircle, Users } from 'lucide-react'
import { RESOURCE_TYPES, BOOKING_STATUSES, resourceTypeEmoji, resourceTypeLabel, bookingStatusLabel, bookingStatusColor, formatDateTime } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function ResourcesTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/resources?clubId=${clubId}` : '/api/resources'
 const { data, loading, refetch } = useFetch<{ resources: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [bookFor, setBookFor] = useState<string | null>(null)

 const resources = data?.resources || []

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">{resources.length} resource(s) · Click to view bookings</p>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Resource</Button>
 </div>

 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
 </div>
 ) : resources.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
 <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
 No resources yet. Add rooms, equipment, vehicles, and more for members to book.
 </CardContent></Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {resources.map(r => (
 <Card key={r.id} className="hover: transition-shadow">
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="text-3xl">{resourceTypeEmoji(r.type)}</div>
 <Badge variant="outline">{resourceTypeLabel(r.type)}</Badge>
 </div>
 <CardTitle className="text-base mt-1">{r.name}</CardTitle>
 <CardDescription className="line-clamp-2">{r.description || r.location || 'No description'}</CardDescription>
 </CardHeader>
 <CardContent className="pt-0 text-xs space-y-1">
 {r.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.location}</div>}
 {r.capacity && <div className="flex items-center gap-1"><Users className="h-3 w-3" />Capacity: {r.capacity}</div>}
 <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r._count?.bookings || 0} total bookings</div>
 {r.requiresApproval && <Badge variant="outline" className="text-foreground text-[10px]">Approval required</Badge>}
 <Button size="sm" className="w-full mt-2" onClick={() => setBookFor(r.id)}><Calendar className="h-3 w-3 mr-1" /> Book</Button>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <CreateResourceDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => { refetch(); setCreateOpen(false) }} />
 {bookFor && <BookResourceDialog resourceId={bookFor} clubId={clubId} onClose={() => setBookFor(null)} />}
 </div>
 )
}

function CreateResourceDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 name: '',
 type: 'ROOM',
 description: '',
 location: '',
 capacity: '',
 requiresApproval: false,
 bookingWindowDays: 90,
 maxBookingHours: 8,
 })

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 await apiPost('/api/resources', {
 ...form,
 clubId,
 capacity: form.capacity ? parseInt(form.capacity) : null,
 })
 toast.success('Resource added')
 onCreated()
 setForm({ ...form, name: '', description: '', location: '', capacity: '' })
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> New Resource</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Auditorium A" /></div>
 <div>
 <Label>Type</Label>
 <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{RESOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 </div>
 <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Main Building, Floor 2" /></div>
 <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="50" /></div>
 </div>
 <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.requiresApproval} onCheckedChange={(v) => setForm({ ...form, requiresApproval: !!v })} /> Requires approval before booking confirmed</label>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Add Resource</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function BookResourceDialog({ resourceId, clubId, onClose }: any) {
 const [form, setForm] = useState({
 startTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
 endTime: new Date(Date.now() + 86400000 + 3600000).toISOString().slice(0, 16),
 purpose: '',
 notes: '',
 })
 const { data: membersData } = useFetch<{ members: any[] }>(clubId !== 'ALL' ? `/api/members?clubId=${clubId}` : '/api/members')
 const userId = membersData?.members?.[0]?.userId || ''

 const submit = async () => {
 try {
 await apiPost(`/api/resources/${resourceId}/bookings`, { ...form, userId })
 toast.success('Booking created')
 onClose()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open onOpenChange={onClose}>
 <DialogContent>
 <DialogHeader><DialogTitle>Book Resource</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Start</Label><Input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
 <div><Label>End</Label><Input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
 </div>
 <div><Label>Purpose</Label><Input value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Weekly meeting" /></div>
 <div><Label>Notes (optional)</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={onClose}>Cancel</Button>
 <Button onClick={submit}>Confirm Booking</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
