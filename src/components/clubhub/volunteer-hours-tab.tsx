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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Clock, Plus, CheckCircle, XCircle, Hourglass, Award, FileText, Heart } from 'lucide-react'
import { avatarColor, initials, formatHours, formatDate, formatDateTime } from '@/lib/clubhub/types'
import { toast } from 'sonner'

const STATUS_STYLES: Record<string, { color: string, icon: any, label: string }> = {
 PENDING: { color: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300', icon: Hourglass, label: 'Pending' },
 APPROVED: { color: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300', icon: CheckCircle, label: 'Approved' },
 REJECTED: { color: 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300', icon: XCircle, label: 'Rejected' },
 DISPUTED: { color: 'bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300', icon: XCircle, label: 'Disputed' },
}

export function VolunteerHoursTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/volunteer-hours?clubId=${clubId}` : '/api/volunteer-hours'
 const { data, loading, refetch } = useFetch<any>(url)
 const [logOpen, setLogOpen] = useState(false)
 const [letterFor, setLetterFor] = useState<string | null>(null)

 const summary = data?.summary || { totalApproved: 0, totalPending: 0, totalEntries: 0 }
 const perMember = data?.perMember || []
 const hours = data?.hours || []

 return (
 <div className="space-y-6">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <Card><CardContent className="p-4">
 <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-2"><CheckCircle className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /></div>
 <div className="text-xs text-muted-foreground">Approved Hours</div>
 <div className="text-xl font-bold">{formatHours(summary.totalApproved)}</div>
 </CardContent></Card>
 <Card><CardContent className="p-4">
 <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-2"><Hourglass className="h-4 w-4 text-amber-700 dark:text-amber-300" /></div>
 <div className="text-xs text-muted-foreground">Pending Review</div>
 <div className="text-xl font-bold">{formatHours(summary.totalPending)}</div>
 </CardContent></Card>
 <Card><CardContent className="p-4">
 <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center mb-2"><Clock className="h-4 w-4 text-blue-700 dark:text-blue-300" /></div>
 <div className="text-xs text-muted-foreground">Total Entries</div>
 <div className="text-xl font-bold">{summary.totalEntries}</div>
 </CardContent></Card>
 <Card><CardContent className="p-4">
 <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center mb-2"><Award className="h-4 w-4 text-purple-700 dark:text-purple-300" /></div>
 <div className="text-xs text-muted-foreground">Active Members</div>
 <div className="text-xl font-bold">{perMember.length}</div>
 </CardContent></Card>
 </div>

 <Tabs defaultValue="entries">
 <div className="flex items-center justify-between">
 <TabsList>
 <TabsTrigger value="entries">All Entries ({hours.length})</TabsTrigger>
 <TabsTrigger value="members">By Member ({perMember.length})</TabsTrigger>
 </TabsList>
 <Button onClick={() => setLogOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Log Hours</Button>
 </div>

 <TabsContent value="entries" className="space-y-3 mt-4">
 {loading ? (
 <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
 ) : hours.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">No hours logged yet. Click"Log Hours" to record service.</CardContent></Card>
 ) : (
 hours.map((h: any) => {
 const style = STATUS_STYLES[h.status] || STATUS_STYLES.PENDING
 const Icon = style.icon
 return (
 <Card key={h.id}>
 <CardContent className="p-4 flex items-start gap-3">
 <Avatar className="h-10 w-10" style={{ backgroundColor: avatarColor(h.user.name) }}>
 <AvatarFallback className="text-white text-xs">{initials(h.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2 flex-wrap">
 <div>
 <div className="font-medium text-sm">{h.user.name}</div>
 <div className="text-xs text-muted-foreground">{h.description}</div>
 <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
 <span>{formatDate(h.date)}</span>
 {h.organization && <><span>·</span><span>{h.organization}</span></>}
 {h.event && <><span>·</span><span>{h.event.title}</span></>}
 {h.supervisor && <><span>·</span><span>Supervisor: {h.supervisor}</span></>}
 </div>
 </div>
 <div className="flex items-center gap-2">
 <div className="text-right">
 <div className="font-mono font-bold text-sm">{formatHours(h.hours)}</div>
 </div>
 <Badge className={style.color}><Icon className="h-3 w-3 mr-1" />{style.label}</Badge>
 {h.status === 'APPROVED' && (
 <Button size="sm" variant="outline" onClick={() => setLetterFor(h.userId)}><FileText className="h-3 w-3 mr-1" /> Letter</Button>
 )}
 {h.status === 'PENDING' && (
 <>
 <Button size="sm" variant="default" className="bg-foreground hover:bg-foreground" onClick={async () => { await apiPatch(`/api/volunteer-hours/${h.id}`, { status: 'APPROVED' }); toast.success('Approved'); refetch() }}><CheckCircle className="h-3 w-3 mr-1" /> Approve</Button>
 <Button size="sm" variant="outline" onClick={async () => { await apiPatch(`/api/volunteer-hours/${h.id}`, { status: 'REJECTED', rejectedReason: 'Rejected by reviewer' }); toast.success('Rejected'); refetch() }}><XCircle className="h-3 w-3" /></Button>
 </>
 )}
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 )
 })
 )}
 </TabsContent>

 <TabsContent value="members" className="space-y-3 mt-4">
 {perMember.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">No data</CardContent></Card>
 ) : (
 <Card>
 <CardContent className="p-0">
 <table className="w-full text-sm">
 <thead className="border-b bg-muted/30">
 <tr>
 <th className="text-left p-3 font-medium">Member</th>
 <th className="text-right p-3 font-medium">Approved</th>
 <th className="text-right p-3 font-medium">Pending</th>
 <th className="text-right p-3 font-medium">Entries</th>
 <th className="p-3"></th>
 </tr>
 </thead>
 <tbody>
 {perMember.map((m: any) => (
 <tr key={m.userId} className="border-b hover:bg-accent/30">
 <td className="p-3 font-medium">{m.name}</td>
 <td className="p-3 text-right font-mono text-foreground">{formatHours(m.approved)}</td>
 <td className="p-3 text-right font-mono text-foreground">{formatHours(m.pending)}</td>
 <td className="p-3 text-right text-muted-foreground">{m.count}</td>
 <td className="p-3 text-right">
 {m.approved > 0 && (
 <Button size="sm" variant="outline" onClick={() => setLetterFor(m.userId)}><FileText className="h-3 w-3 mr-1" /> Service Letter</Button>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </CardContent>
 </Card>
 )}
 </TabsContent>
 </Tabs>

 <LogHoursDialog open={logOpen} onOpenChange={setLogOpen} clubId={clubId} onCreated={() => { refetch(); setLogOpen(false) }} />
 {letterFor && <ServiceLetterDialog userId={letterFor} clubId={clubId} onClose={() => setLetterFor(null)} />}
 </div>
 )
}

function LogHoursDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 userId: '',
 hours: '',
 date: new Date().toISOString().split('T')[0],
 description: '',
 organization: '',
 location: '',
 supervisor: '',
 })
 const { data: membersData } = useFetch<{ members: any[] }>(clubId !== 'ALL' ? `/api/members?clubId=${clubId}` : '/api/members')

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Please select a specific club'); return }
 if (!form.userId) { toast.error('Select a member'); return }
 await apiPost('/api/volunteer-hours', { ...form, hours: parseFloat(form.hours) })
 toast.success('Hours logged — pending approval')
 onCreated()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle className="flex items-center gap-2"><Heart className="h-4 w-4" /> Log Volunteer Hours</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div>
 <Label>Member</Label>
 <Select value={form.userId} onValueChange={v => setForm({ ...form, userId: v })}>
 <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
 <SelectContent>
 {(membersData?.members || []).map((m: any) => <SelectItem key={m.id} value={m.userId}>{m.user.name}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Hours</Label><Input type="number" step="0.25" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} placeholder="2.5" /></div>
 <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
 </div>
 <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What did they do?" /></div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Organization</Label><Input value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} placeholder="e.g. Local Food Bank" /></div>
 <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Downtown" /></div>
 </div>
 <div><Label>Supervisor (name & contact)</Label><Input value={form.supervisor} onChange={e => setForm({ ...form, supervisor: e.target.value })} placeholder="e.g. Jane Doe, jane@foodbank.org" /></div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Submit for Approval</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function ServiceLetterDialog({ userId, clubId, onClose }: any) {
 const { data, loading } = useFetch<any>(`/api/reports?type=service-letter&clubId=${clubId}&userId=${userId}`)

 if (loading) return <Dialog open onOpenChange={onClose}><DialogContent><Skeleton className="h-64 w-full" /></DialogContent></Dialog>

 const club = data?.club
 const user = data?.user
 const totalHours = data?.totalHours || 0
 const hours = data?.hours || []
 const memberSince = data?.memberSince ? new Date(data.memberSince).toLocaleDateString() : ''

 const letterText = `${club?.advisor?.name || 'Club Advisor'}
${club?.name}
${new Date().toLocaleDateString()}

To Whom It May Concern,

This letter is to certify that ${user?.name} has completed ${totalHours} hour(s) of volunteer service through ${club?.name}${club?.advisor ? ` under my supervision` : ''}.

${user?.name} has been an active member of ${club?.name} since ${memberSince}, and has demonstrated dedication, leadership, and a strong commitment to serving our community.

Below is a summary of the service hours completed:

${hours.map((h: any) => `• ${new Date(h.date).toLocaleDateString()} — ${h.hours}h — ${h.description}${h.organization ? ` (${h.organization})` : ''}`).join('\n')}

Total Verified Hours: ${totalHours}

If you have any questions, please do not hesitate to contact me.

Sincerely,

${club?.advisor?.name || '_______________'}
${club?.advisor ? 'Advisor, ' + club.name : ''}
${club?.advisor?.email || ''}`

 return (
 <Dialog open onOpenChange={onClose}>
 <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
 <DialogHeader><DialogTitle className="flex items-center gap-2"><Award className="h-4 w-4" /> Service Letter — {user?.name}</DialogTitle></DialogHeader>
 <div className="space-y-3">
 {/* #print-area: window.print() should only print the letter, not the whole app shell. */}
 <style>{`@media print { body * { visibility: hidden } #print-area, #print-area * { visibility: visible } #print-area { position: absolute; left: 0; top: 0; width: 100% } }`}</style>
 <div id="print-area" className="rounded-lg border p-4 bg-muted/30 font-mono text-xs whitespace-pre-wrap leading-relaxed">{letterText}</div>
 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={() => navigator.clipboard.writeText(letterText)}>Copy to Clipboard</Button>
 <Button onClick={() => window.print()}>Print / Save as PDF</Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 )
}
