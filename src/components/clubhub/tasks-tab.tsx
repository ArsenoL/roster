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
import { CheckSquare, Plus, ListTodo, AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react'
import { TASK_STATUSES, TASK_PRIORITIES, taskStatusLabel, taskStatusColor, taskPriorityLabel, taskPriorityColor, formatDate } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function TasksTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/tasks?clubId=${clubId}` : '/api/tasks'
 const { data, loading, refetch } = useFetch<any>(url)
 const [createOpen, setCreateOpen] = useState(false)

 const tasks = data?.tasks || []
 const lists = data?.lists || []
 const stats = data?.stats || { total: 0, todo: 0, inProgress: 0, done: 0, blocked: 0, overdue: 0 }

 return (
 <div className="space-y-4">
 <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
 <StatChip label="Total" value={stats.total} color="text-foreground" />
 <StatChip label="To Do" value={stats.todo} color="text-gray-600" />
 <StatChip label="In Progress" value={stats.inProgress} color="text-foreground" />
 <StatChip label="Done" value={stats.done} color="text-foreground" />
 <StatChip label="Blocked" value={stats.blocked} color="text-foreground" />
 <StatChip label="Overdue" value={stats.overdue} color="text-foreground" />
 </div>

 <Tabs defaultValue="board">
 <div className="flex items-center justify-between">
 <TabsList>
 <TabsTrigger value="board"><ListTodo className="h-3.5 w-3.5 mr-1" /> Kanban</TabsTrigger>
 <TabsTrigger value="list">List</TabsTrigger>
 </TabsList>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Task</Button>
 </div>

 <TabsContent value="board" className="mt-4">
 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 overflow-x-auto">
 {TASK_STATUSES.filter(s => s.value !== 'CANCELLED').map(status => {
 const colTasks = tasks.filter(t => t.status === status.value)
 return (
 <div key={status.value} className="bg-muted/30 rounded-lg p-2 min-h-[200px]">
 <div className="flex items-center justify-between mb-2 px-1">
 <div className="text-sm font-medium">{status.label}</div>
 <Badge variant="outline" className="text-[10px]">{colTasks.length}</Badge>
 </div>
 <div className="space-y-2">
 {colTasks.map(t => <TaskCard key={t.id} task={t} onChanged={refetch} />)}
 </div>
 </div>
 )
 })}
 </div>
 )}
 </TabsContent>

 <TabsContent value="list" className="mt-4 space-y-2">
 {tasks.map(t => <TaskRow key={t.id} task={t} onChanged={refetch} />)}
 </TabsContent>
 </Tabs>

 <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} lists={lists} onCreated={() => { refetch(); setCreateOpen(false) }} />
 </div>
 )
}

function StatChip({ label, value, color }: any) {
 return (
 <Card><CardContent className="p-3">
 <div className="text-xs text-muted-foreground">{label}</div>
 <div className={`text-2xl font-bold ${color}`}>{value}</div>
 </CardContent></Card>
 )
}

function TaskCard({ task, onChanged }: any) {
 const updateStatus = async (status: string) => {
 await apiPatch(`/api/tasks/${task.id}`, { status })
 onChanged()
 }
 return (
 <div className="bg-background rounded-md border p-2.5 hover:transition-shadow">
 <div className="flex items-start justify-between gap-1 mb-1">
 <div className="text-sm font-medium leading-tight">{task.title}</div>
 <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: taskPriorityColor(task.priority) }} />
 </div>
 {task.description && <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</div>}
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 {task.assignee && <span>{task.assignee.name}</span>}
 {task.dueDate && <><span>·</span><span className={new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'text-foreground font-medium' : ''}>{formatDate(task.dueDate)}</span></>}
 </div>
 {task.committee && <Badge variant="outline" className="text-[10px] mt-1.5" style={{ color: task.committee.color }}>{task.committee.name}</Badge>}
 {task.status !== 'DONE' && (
 <button onClick={() => updateStatus('DONE')} className="mt-2 w-full text-xs flex items-center justify-center gap-1 py-1 rounded hover:bg-foreground dark:hover:bg-emerald-950/30 text-foreground">
 <CheckCircle2 className="h-3 w-3" /> Mark Done
 </button>
 )}
 </div>
 )
}

function TaskRow({ task, onChanged }: any) {
 const [expanded, setExpanded] = useState(false)
 const update = async (patch: any) => {
 await apiPatch(`/api/tasks/${task.id}`, patch)
 onChanged()
 }
 return (
 <Card>
 <CardContent className="p-3">
 <div className="flex items-start gap-3">
 <button onClick={() => update({ status: task.status === 'DONE' ? 'TODO' : 'DONE' })} className="mt-0.5">
 <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${task.status === 'DONE' ? 'border-foreground bg-foreground' : 'border-gray-300'}`}>
 {task.status === 'DONE' && <CheckCircle2 className="h-3 w-3 text-white" />}
 </div>
 </button>
 <div className="flex-1 min-w-0">
 <div className={`font-medium text-sm ${task.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`} onClick={() => setExpanded(!expanded)}>{task.title}</div>
 {task.dueDate && (
 <div className={`text-xs ${new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'text-foreground' : 'text-muted-foreground'}`}>
 Due {formatDate(task.dueDate)}
 </div>
 )}
 </div>
 <Badge style={{ backgroundColor: taskStatusColor(task.status) + '20', color: taskStatusColor(task.status) }}>{taskStatusLabel(task.status)}</Badge>
 <Badge variant="outline" style={{ color: taskPriorityColor(task.priority) }}>{taskPriorityLabel(task.priority)}</Badge>
 <Select value={task.priority} onValueChange={v => update({ priority: v })}>
 <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
 <SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>
 )
}

function CreateTaskDialog({ open, onOpenChange, clubId, lists, onCreated }: any) {
 const [form, setForm] = useState({
 title: '',
 description: '',
 status: 'TODO',
 priority: 'MEDIUM',
 assigneeId: '',
 dueDate: '',
 committeeId: '',
 listId: '',
 })
 const { data: membersData } = useFetch<{ members: any[] }>(clubId !== 'ALL' ? `/api/members?clubId=${clubId}` : '/api/members')
 const { data: committeesData } = useFetch<{ committees: any[] }>(clubId !== 'ALL' ? `/api/committees?clubId=${clubId}` : '/api/committees')

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 if (!form.title) { toast.error('Title required'); return }
 await apiPost('/api/tasks', {
 ...form,
 clubId,
 dueDate: form.dueDate || null,
 assigneeId: form.assigneeId || null,
 committeeId: form.committeeId || null,
 listId: form.listId || null,
 })
 toast.success('Task created')
 onCreated()
 setForm({ ...form, title: '', description: '' })
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckSquare className="h-4 w-4" /> New Task</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Order pizza for the meeting" /></div>
 <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Priority</Label>
 <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{TASK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Assignee</Label>
 <Select value={form.assigneeId} onValueChange={v => setForm({ ...form, assigneeId: v })}>
 <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
 <SelectContent>{(membersData?.members || []).map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.user.name}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div>
 <Label>Committee</Label>
 <Select value={form.committeeId} onValueChange={v => setForm({ ...form, committeeId: v })}>
 <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
 <SelectContent>{(committeesData?.committees || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Create Task</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
