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
import { ClipboardList, Plus, FileText, BarChart3, Eye, Trash2, Download } from 'lucide-react'
import { FORM_TYPES, formTypeLabel, formTypeIcon, formatDateTime, timeAgo } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function FormsTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/forms?clubId=${clubId}` : '/api/forms'
 const { data, loading, refetch } = useFetch<{ forms: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [viewForm, setViewForm] = useState<string | null>(null)

 const forms = data?.forms || []

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">{forms.length} form(s) total</p>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Form</Button>
 </div>

 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
 </div>
 ) : forms.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
 <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
 No forms yet. Create RSVPs, feedback surveys, signup sheets, and more.
 </CardContent></Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {forms.map(f => (
 <Card key={f.id} className="hover: transition-shadow cursor-pointer" onClick={() => setViewForm(f.id)}>
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="text-3xl">{formTypeIcon(f.type)}</div>
 <Badge variant={f.status === 'OPEN' ? 'default' : 'outline'}>{f.status}</Badge>
 </div>
 <CardTitle className="text-base mt-1">{f.title}</CardTitle>
 <CardDescription className="line-clamp-2">{f.description || 'No description'}</CardDescription>
 </CardHeader>
 <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
 <div className="flex items-center justify-between">
 <span>{formTypeLabel(f.type)}</span>
 <span>{f.fields?.length || 0} fields</span>
 </div>
 <div className="flex items-center justify-between">
 <span><FileText className="h-3 w-3 inline mr-1" />{f._count?.responses || 0} responses</span>
 {f.deadline && <span>Due {timeAgo(f.deadline)}</span>}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <CreateFormDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => { refetch(); setCreateOpen(false) }} />
 {viewForm && <ViewFormDialog formId={viewForm} onClose={() => setViewForm(null)} />}
 </div>
 )
}

function CreateFormDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 title: '',
 description: '',
 type: 'SURVEY',
 status: 'OPEN',
 deadline: '',
 successMessage: 'Thank you for your response!',
 isAnonymous: false,
 collectName: true,
 })
 const [fields, setFields] = useState<any[]>([
 { name: 'q1', label: 'Question 1', type: 'TEXT', required: false }
 ])

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 if (!form.title) { toast.error('Title required'); return }
 await apiPost('/api/forms', {
 ...form,
 clubId,
 deadline: form.deadline || null,
 fields,
 })
 toast.success('Form created')
 onCreated()
 setForm({ ...form, title: '', description: '' })
 setFields([{ name: 'q1', label: 'Question 1', type: 'TEXT', required: false }])
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
 <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Create Form</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Spring Trip RSVP" /></div>
 <div>
 <Label>Type</Label>
 <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{FORM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 </div>
 <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Deadline (optional)</Label><Input type="datetime-local" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
 <div><Label>Success Message</Label><Input value={form.successMessage} onChange={e => setForm({ ...form, successMessage: e.target.value })} /></div>
 </div>
 <div>
 <div className="flex items-center justify-between mb-2">
 <Label>Questions</Label>
 <Button size="sm" variant="outline" onClick={() => setFields([...fields, { name: `q${fields.length + 1}`, label: `Question ${fields.length + 1}`, type: 'TEXT', required: false }])}><Plus className="h-3 w-3 mr-1" /> Add Question</Button>
 </div>
 <div className="space-y-2">
 {fields.map((f, i) => (
 <div key={i} className="flex gap-2 items-end p-2 rounded border">
 <div className="flex-1"><Input value={f.label} onChange={e => setFields(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Question" /></div>
 <div className="w-32">
 <Select value={f.type} onValueChange={v => setFields(prev => prev.map((x, j) => j === i ? { ...x, type: v } : x))}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="TEXT">Text</SelectItem>
 <SelectItem value="TEXTAREA">Long Text</SelectItem>
 <SelectItem value="NUMBER">Number</SelectItem>
 <SelectItem value="DATE">Date</SelectItem>
 <SelectItem value="SELECT">Dropdown</SelectItem>
 <SelectItem value="CHECKBOX">Checkbox</SelectItem>
 <SelectItem value="RATING">Star Rating</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={f.required} onChange={e => setFields(prev => prev.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} /> Req</label>
 {fields.length > 1 && <Button variant="ghost" size="icon" onClick={() => setFields(prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>}
 </div>
 ))}
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Create Form</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function ViewFormDialog({ formId, onClose }: any) {
 const { data, loading } = useFetch<any>(`/api/forms/${formId}?responses=true`)
 const form = data?.form

 if (loading) return <Dialog open onOpenChange={onClose}><DialogContent><Skeleton className="h-64 w-full" /></DialogContent></Dialog>

 const responses = form?.responses || []
 const fields = form?.fields || []

 return (
 <Dialog open onOpenChange={onClose}>
 <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> {form?.title}</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 <div className="grid grid-cols-3 gap-3 text-sm">
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Status</div><div className="font-medium">{form?.status}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Responses</div><div className="font-medium">{responses.length}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Questions</div><div className="font-medium">{fields.length}</div></CardContent></Card>
 </div>

 <div>
 <h4 className="text-sm font-semibold mb-2">Responses</h4>
 {responses.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No responses yet</div>
 ) : (
 <div className="space-y-2 max-h-96 overflow-y-auto">
 {responses.map((r: any) => {
 const data = JSON.parse(r.data)
 return (
 <Card key={r.id}>
 <CardContent className="p-3">
 <div className="text-xs text-muted-foreground mb-2">{r.user?.name || 'Anonymous'} · {formatDateTime(r.submittedAt)}</div>
 <div className="space-y-1 text-sm">
 {fields.map(f => (
 <div key={f.id} className="flex gap-2">
 <span className="text-muted-foreground min-w-[120px]">{f.label}:</span>
 <span>{data[f.name] || '—'}</span>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )
 })}
 </div>
 )}
 </div>

 <div className="flex justify-end gap-2">
 <Button variant="outline" onClick={async () => {
 const csv = [
 fields.map(f => f.label).join(','),
 ...responses.map((r: any) => {
 const d = JSON.parse(r.data)
 return fields.map(f => `"${d[f.name] || ''}"`).join(',')
 }),
 ].join('\n')
 const blob = new Blob([csv], { type: 'text/csv' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `${form?.title}-responses.csv`
 a.click()
 }}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
 <Button variant="outline" onClick={async () => {
 await apiPatch(`/api/forms/${formId}`, { status: form?.status === 'OPEN' ? 'CLOSED' : 'OPEN' })
 toast.success(`Form ${form?.status === 'OPEN' ? 'closed' : 'reopened'}`)
 onClose()
 }}>{form?.status === 'OPEN' ? 'Close Form' : 'Reopen Form'}</Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 )
}
