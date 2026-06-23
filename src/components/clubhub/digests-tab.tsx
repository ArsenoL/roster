'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, Plus, Send, Clock, Bell, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export function DigestsTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/digests?clubId=${clubId}` : '/api/digests'
 const { data, loading, refetch } = useFetch<{ subscriptions: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [sending, setSending] = useState(false)

 const subs = data?.subscriptions || []

 async function sendAll() {
 setSending(true)
 try {
 const d = await apiPost('/api/digests/send', { clubId: clubId !== 'ALL' ? clubId : undefined, forceAll: true })
 toast.success(`Sent ${d.sent} digest(s)`)
 refetch()
 } catch (e: any) { if (!e?.silent) toast.error(e.message) } finally {
 setSending(false)
 }
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Email Digests</h2>
 <p className="text-sm text-muted-foreground">Automated weekly summaries — attendance, announcements, upcoming events, open tasks.</p>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" onClick={sendAll} disabled={sending || subs.length === 0}>
 <Send className="h-4 w-4 mr-1" /> {sending ? 'Sending…' : 'Send now'}
 </Button>
 <Button onClick={() => setCreateOpen(true)} disabled={clubId === 'ALL'}><Plus className="h-4 w-4" /> Add subscriber</Button>
 </div>
 </div>

 {loading ? (
 <Skeleton className="h-64 w-full" />
 ) : subs.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No digest subscriptions yet.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {subs.map((s) => (
 <Card key={s.id}>
 <CardContent className="p-4 flex items-center gap-3 flex-wrap">
 <div className="flex-1 min-w-[200px]">
 <div className="font-medium">{s.user?.name}</div>
 <div className="text-xs text-muted-foreground">{s.user?.email}</div>
 </div>
 <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
 <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-1" /> {s.frequency}</Badge>
 {s.dayOfWeek != null && <span><Calendar className="h-3 w-3 inline" /> Day {s.dayOfWeek}</span>}
 <span>{s.hourOfDay}:00</span>
 {s.lastSentAt ? <span>Last sent {new Date(s.lastSentAt).toLocaleDateString()}</span> : <span className="text-foreground">Never sent</span>}
 </div>
 <Switch
 checked={s.isActive}
 onCheckedChange={async (v) => {
 try {
 await apiPost('/api/digests', { userId: s.userId, clubId: s.clubId, isActive: v })
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }}
 />
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <CreateDigestDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => refetch()} />
 </div>
 )
}

function CreateDigestDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const { data: membersData } = useFetch<{ members: any[] }>(`/api/members?clubId=${clubId}&limit=200`)
 const [userId, setUserId] = useState('')
 const [frequency, setFrequency] = useState('WEEKLY')
 const [dayOfWeek, setDayOfWeek] = useState('1')
 const [hourOfDay, setHourOfDay] = useState('8')

 const members = membersData?.members || []

 async function submit() {
 if (!userId) { toast.error('Pick a member'); return }
 try {
 await apiPost('/api/digests', {
 userId, clubId, frequency,
 dayOfWeek: parseInt(dayOfWeek),
 hourOfDay: parseInt(hourOfDay),
 })
 toast.success('Digest subscription created')
 setUserId('')
 onOpenChange(false)
 onCreated()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Add digest subscriber</DialogTitle>
 <DialogDescription>Subscribes a member to automated digest emails about this club.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Member</Label>
 <Select value={userId} onValueChange={setUserId}>
 <SelectTrigger><SelectValue placeholder="Pick a member…" /></SelectTrigger>
 <SelectContent>
 {members.map((m: any) => (
 <SelectItem key={m.userId} value={m.userId}>{m.user?.name} ({m.user?.email})</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Frequency</Label>
 <Select value={frequency} onValueChange={setFrequency}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="DAILY">Daily</SelectItem>
 <SelectItem value="WEEKLY">Weekly</SelectItem>
 <SelectItem value="MONTHLY">Monthly</SelectItem>
 </SelectContent>
 </Select>
 </div>
 {frequency === 'WEEKLY' && (
 <div>
 <Label>Day of week</Label>
 <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="0">Sunday</SelectItem>
 <SelectItem value="1">Monday</SelectItem>
 <SelectItem value="2">Tuesday</SelectItem>
 <SelectItem value="3">Wednesday</SelectItem>
 <SelectItem value="4">Thursday</SelectItem>
 <SelectItem value="5">Friday</SelectItem>
 <SelectItem value="6">Saturday</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}
 <div>
 <Label>Hour of day (0-23)</Label>
 <Input value={hourOfDay} onChange={(e) => setHourOfDay(e.target.value)} type="number" min={0} max={23} />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Subscribe</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
