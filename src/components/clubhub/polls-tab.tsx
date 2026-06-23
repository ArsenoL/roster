'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiPatch } from '@/lib/clubhub/hooks'
import { useAuth } from '@/lib/clubhub/use-auth'
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
import { Vote, Plus, CheckCircle, BarChart3, Clock, Users } from 'lucide-react'
import { POLL_TYPES, pollTypeLabel, formatDateTime, timeAgo, timeUntil } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function PollsTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/polls?clubId=${clubId}` : '/api/polls'
 const { data, loading, refetch } = useFetch<{ polls: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)

 const polls = data?.polls || []
 const openPolls = polls.filter(p => p.status === 'OPEN')
 const closedPolls = polls.filter(p => p.status === 'CLOSED')
 const drafts = polls.filter(p => p.status === 'DRAFT')

 return (
 <div className="space-y-4">
 <div className="grid grid-cols-3 gap-3">
 <Card><CardContent className="p-4 flex items-center gap-3">
 <Vote className="h-8 w-8 text-foreground" />
 <div><div className="text-2xl font-bold">{openPolls.length}</div><div className="text-xs text-muted-foreground">Open polls</div></div>
 </CardContent></Card>
 <Card><CardContent className="p-4 flex items-center gap-3">
 <Clock className="h-8 w-8 text-foreground" />
 <div><div className="text-2xl font-bold">{drafts.length}</div><div className="text-xs text-muted-foreground">Drafts</div></div>
 </CardContent></Card>
 <Card><CardContent className="p-4 flex items-center gap-3">
 <BarChart3 className="h-8 w-8 text-foreground" />
 <div><div className="text-2xl font-bold">{closedPolls.length}</div><div className="text-xs text-muted-foreground">Closed</div></div>
 </CardContent></Card>
 </div>

 <Tabs defaultValue="open">
 <div className="flex items-center justify-between">
 <TabsList>
 <TabsTrigger value="open">Open ({openPolls.length})</TabsTrigger>
 <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
 <TabsTrigger value="closed">Closed ({closedPolls.length})</TabsTrigger>
 </TabsList>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Poll</Button>
 </div>

 {(['open', 'drafts', 'closed'] as const).map(tab => (
 <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
 {loading ? (
 <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
 ) : (tab === 'open' ? openPolls : tab === 'drafts' ? drafts : closedPolls).length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">No {tab} polls</CardContent></Card>
 ) : (
 (tab === 'open' ? openPolls : tab === 'drafts' ? drafts : closedPolls).map(p => <PollCard key={p.id} poll={p} clubId={clubId} onChanged={refetch} />)
 )}
 </TabsContent>
 ))}
 </Tabs>

 <CreatePollDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => { refetch(); setCreateOpen(false) }} />
 </div>
 )
}

function PollCard({ poll, clubId, onChanged }: any) {
 const [selectedOptions, setSelectedOptions] = useState<string[]>([])
 const { user } = useAuth()
 const currentUserId = user?.id || ''

 const toggleOption = (oid: string) => {
 if (poll.type === 'SINGLE_CHOICE' || poll.type === 'YES_NO') {
 setSelectedOptions([oid])
 } else {
 setSelectedOptions(prev => prev.includes(oid) ? prev.filter(x => x !== oid) : [...prev, oid])
 }
 }

 const vote = async () => {
 try {
 if (!currentUserId) { toast.error('Sign in to vote'); return }
 if (selectedOptions.length === 0) { toast.error('Select an option'); return }
 await apiPost(`/api/polls/${poll.id}`, { userId: currentUserId, optionIds: selectedOptions })
 toast.success('Vote cast!')
 setSelectedOptions([])
 onChanged()
 } catch (e: any) { toast.error(e.message) }
 }

 const close = async () => {
 await apiPatch(`/api/polls/${poll.id}`, { status: 'CLOSED', showResults: true })
 toast.success('Poll closed')
 onChanged()
 }

 const open = async () => {
 await apiPatch(`/api/polls/${poll.id}`, { status: 'OPEN' })
 toast.success('Poll opened')
 onChanged()
 }

 const totalVotes = poll.options.reduce((s: number, o: any) => s + (o._count?.votes || 0), 0)
 const showResults = poll.showResults || poll.status === 'CLOSED'

 return (
 <Card>
 <CardHeader>
 <div className="flex items-start justify-between gap-2">
 <div>
 <CardTitle className="text-base flex items-center gap-2">
 {poll.title}
 {poll.isOfficial && <Badge className="bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">Official</Badge>}
 </CardTitle>
 <CardDescription className="mt-1">
 {pollTypeLabel(poll.type)} · ends {formatDateTime(poll.endDate)} ({new Date(poll.endDate) > new Date() ? timeUntil(poll.endDate) : timeAgo(poll.endDate)})
 <br />{totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {poll.allowAnonymous ? 'Anonymous' : 'Identified'}
 </CardDescription>
 </div>
 <Badge variant={poll.status === 'OPEN' ? 'default' : poll.status === 'CLOSED' ? 'secondary' : 'outline'}>{poll.status}</Badge>
 </div>
 </CardHeader>
 <CardContent className="space-y-2">
 {poll.options.map((o: any) => {
 const isSel = selectedOptions.includes(o.id)
 const votes = o._count?.votes || 0
 const share = o.voteShare || 0
 return (
 <button
 key={o.id}
 onClick={() => poll.status === 'OPEN' && toggleOption(o.id)}
 disabled={poll.status !== 'OPEN'}
 className={`w-full text-left p-3 rounded-lg border transition-colors ${isSel ? 'border-primary bg-primary/5' : 'hover:bg-accent/30'} ${poll.status !== 'OPEN' ? 'cursor-default' : ''}`}
 >
 <div className="flex items-center justify-between mb-1">
 <div className="flex items-center gap-2">
 {poll.status === 'OPEN' && (
 <div className={`w-4 h-4 rounded-full border-2 ${poll.type === 'SINGLE_CHOICE' || poll.type === 'YES_NO' ? 'rounded-full' : 'rounded'} ${isSel ? 'border-primary bg-primary' : ''}`} />
 )}
 <span className="font-medium text-sm">{o.text}</span>
 </div>
 {showResults && (
 <span className="text-xs text-muted-foreground font-mono">{votes} ({share.toFixed(0)}%)</span>
 )}
 </div>
 {showResults && (
 <div className="h-1.5 bg-muted rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${share}%` }} />
 </div>
 )}
 </button>
 )
 })}
 {poll.status === 'OPEN' && (
 <div className="flex gap-2 pt-2">
 <Button onClick={vote} disabled={selectedOptions.length === 0} size="sm"><Vote className="h-4 w-4 mr-1" /> Cast Vote</Button>
 <Button onClick={close} variant="outline" size="sm">Close Poll & Show Results</Button>
 </div>
 )}
 {poll.status === 'DRAFT' && (
 <Button onClick={open} size="sm">Open Poll</Button>
 )}
 </CardContent>
 </Card>
 )
}

function CreatePollDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 title: '',
 description: '',
 type: 'SINGLE_CHOICE',
 endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
 allowAnonymous: true,
 isOfficial: false,
 })
 const [options, setOptions] = useState(['', ''])

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 const validOptions = options.filter(o => o.trim())
 if (validOptions.length < 2) { toast.error('Need at least 2 options'); return }
 await apiPost('/api/polls', { ...form, clubId, options: validOptions.map((t, i) => ({ text: t, sortOrder: i })) })
 toast.success('Poll created')
 onCreated()
 setForm({ ...form, title: '', description: '' })
 setOptions(['', ''])
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle className="flex items-center gap-2"><Vote className="h-4 w-4" /> Create Poll / Election</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Next semester's project theme" /></div>
 <div><Label>Description (optional)</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Type</Label>
 <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{POLL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div><Label>End Date</Label><Input type="datetime-local" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
 </div>
 <div>
 <Label>Options</Label>
 <div className="space-y-2">
 {options.map((o, i) => (
 <div key={i} className="flex gap-2">
 <Input value={o} onChange={e => setOptions(prev => prev.map((x, j) => j === i ? e.target.value : x))} placeholder={`Option ${i + 1}`} />
 {options.length > 2 && <Button variant="ghost" size="icon" onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}>×</Button>}
 </div>
 ))}
 <Button variant="outline" size="sm" onClick={() => setOptions([...options, ''])}><Plus className="h-3 w-3 mr-1" /> Add option</Button>
 </div>
 </div>
 <div className="flex items-center gap-4 pt-1">
 <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.allowAnonymous} onCheckedChange={(v) => setForm({ ...form, allowAnonymous: !!v })} /> Anonymous voting</label>
 <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.isOfficial} onCheckedChange={(v) => setForm({ ...form, isOfficial: !!v })} /> Official election</label>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Create Poll</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
