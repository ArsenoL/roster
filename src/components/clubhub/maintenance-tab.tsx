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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Wrench, Calendar, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

const MAINTENANCE_TYPES = ['SCHEDULED', 'REPAIR', 'INSPECTION', 'CLEANING', 'REPLACEMENT']
const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

export function MaintenanceTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/maintenance?clubId=${clubId}` : '/api/maintenance'
 const { data, loading, refetch } = useFetch<{ logs: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

 const allLogs = data?.logs || []
 const logs = allLogs.filter((l) => {
 if (filter === 'active') return l.status !== 'COMPLETED' && l.status !== 'CANCELLED'
 if (filter === 'completed') return l.status === 'COMPLETED'
 return true
 })

 const stats = {
 scheduled: allLogs.filter((l) => l.status === 'SCHEDULED').length,
 inProgress: allLogs.filter((l) => l.status === 'IN_PROGRESS').length,
 completed: allLogs.filter((l) => l.status === 'COMPLETED').length,
 totalCost: allLogs.filter((l) => l.status === 'COMPLETED').reduce((s, l) => s + (l.cost || 0), 0),
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Equipment Maintenance</h2>
 <p className="text-sm text-muted-foreground">Track repairs, inspections, cleanings, and scheduled maintenance for club gear.</p>
 </div>
 <Button onClick={() => setCreateOpen(true)} disabled={clubId === 'ALL'}><Plus className="h-4 w-4" /> Log maintenance</Button>
 </div>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Scheduled</div><div className="text-2xl font-bold text-foreground">{stats.scheduled}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">In progress</div><div className="text-2xl font-bold text-foreground">{stats.inProgress}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-bold text-foreground">{stats.completed}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total cost</div><div className="text-2xl font-bold">${stats.totalCost.toFixed(0)}</div></CardContent></Card>
 </div>

 <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
 <TabsList>
 <TabsTrigger value="all">All ({allLogs.length})</TabsTrigger>
 <TabsTrigger value="active">Active ({stats.scheduled + stats.inProgress})</TabsTrigger>
 <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
 </TabsList>
 <TabsContent value={filter} className="mt-4">
 {loading ? (
 <Skeleton className="h-64 w-full" />
 ) : logs.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No maintenance logs to show.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {logs.map((l) => (
 <Card key={l.id}>
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-3 flex-wrap">
 <div className="flex-1 min-w-[200px]">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-semibold">{l.item?.name || 'Unknown item'}</h3>
 <Badge variant="outline" className="text-[10px]">{l.type}</Badge>
 <Badge variant="outline" className={l.status === 'COMPLETED' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[10px]' : l.status === 'IN_PROGRESS' ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[10px]' : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-[10px]'}>
 {l.status.replace('_', ' ')}
 </Badge>
 </div>
 <div className="text-sm text-muted-foreground mt-1">{l.description}</div>
 <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
 {l.cost > 0 && <span><DollarSign className="h-3 w-3 inline" /> ${l.cost}</span>}
 {l.vendor && <span>Vendor: {l.vendor}</span>}
 {l.scheduledFor && <span><Calendar className="h-3 w-3 inline" /> {new Date(l.scheduledFor).toLocaleDateString()}</span>}
 {l.completedAt && <span><CheckCircle2 className="h-3 w-3 inline" /> {new Date(l.completedAt).toLocaleDateString()}</span>}
 {l.performedBy && <span>By {l.performedBy.name}</span>}
 </div>
 {l.notes && <div className="text-xs text-muted-foreground mt-1 italic">{l.notes}</div>}
 </div>
 {l.status !== 'COMPLETED' && l.status !== 'CANCELLED' && (
 <Button
 size="sm"
 variant="outline"
 onClick={async () => {
 try {
 await apiPatch(`/api/maintenance/${l.id}`, { status: 'COMPLETED', completedAt: new Date().toISOString() })
 toast.success('Marked as completed')
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }}
 >
 Mark complete
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </TabsContent>
 </Tabs>

 <CreateMaintenanceDialog
 open={createOpen}
 onOpenChange={setCreateOpen}
 clubId={clubId}
 onCreated={() => refetch()}
 />
 </div>
 )
}

function CreateMaintenanceDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const { data: itemsData } = useFetch<{ items: any[] }>(`/api/inventory?clubId=${clubId}`)
 const [itemId, setItemId] = useState('')
 const [type, setType] = useState('REPAIR')
 const [description, setDescription] = useState('')
 const [cost, setCost] = useState('')
 const [vendor, setVendor] = useState('')
 const [scheduledFor, setScheduledFor] = useState('')
 const [notes, setNotes] = useState('')

 const items = itemsData?.items || []

 async function submit() {
 if (!itemId || !description) { toast.error('Item and description required'); return }
 try {
 await apiPost('/api/maintenance', {
 itemId, type, description, clubId,
 cost: cost ? parseFloat(cost) : 0,
 vendor: vendor || null,
 scheduledFor: scheduledFor || null,
 notes: notes || null,
 })
 toast.success('Maintenance logged')
 // Reset
 setItemId(''); setDescription(''); setCost(''); setVendor(''); setScheduledFor(''); setNotes('')
 onOpenChange(false)
 onCreated()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Log maintenance</DialogTitle>
 <DialogDescription>Record a repair, inspection, or scheduled maintenance for an inventory item.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Item</Label>
 <Select value={itemId} onValueChange={setItemId}>
 <SelectTrigger><SelectValue placeholder="Pick an item…" /></SelectTrigger>
 <SelectContent>
 {items.map((i: any) => (
 <SelectItem key={i.id} value={i.id}>{i.name} {i.condition !== 'NEW' && `(${i.condition})`}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Type</Label>
 <Select value={type} onValueChange={setType}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {MAINTENANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Cost ($)</Label>
 <Input value={cost} onChange={(e) => setCost(e.target.value)} type="number" step="0.01" placeholder="0.00" />
 </div>
 </div>
 <div>
 <Label>Description</Label>
 <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What needs to be done?" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Vendor (optional)</Label>
 <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g., Local Bike Shop" />
 </div>
 <div>
 <Label>Scheduled for (optional)</Label>
 <Input value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} type="date" />
 </div>
 </div>
 <div>
 <Label>Notes</Label>
 <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Log maintenance</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
