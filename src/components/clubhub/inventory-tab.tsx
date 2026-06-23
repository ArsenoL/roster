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
import { Package, Plus, Boxes, ArrowRightLeft, AlertTriangle, DollarSign } from 'lucide-react'
import { INVENTORY_CATEGORIES, ITEM_CONDITIONS, LOAN_STATUSES, inventoryCategoryEmoji, itemConditionLabel, itemConditionColor, loanStatusLabel, loanStatusColor, formatCurrency, formatDate, formatDateTime } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function InventoryTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/inventory?clubId=${clubId}` : '/api/inventory'
 const { data, loading, refetch } = useFetch<any>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [loanFor, setLoanFor] = useState<string | null>(null)

 const items = data?.items || []
 const summary = data?.summary || { totalItems: 0, totalValue: 0, available: 0, outOnLoan: 0, byCondition: {} }

 const loansUrl = clubId !== 'ALL' ? `/api/inventory/loans?clubId=${clubId}` : '/api/inventory/loans'
 const { data: loansData, refetch: refetchLoans } = useFetch<{ loans: any[] }>(loansUrl)
 const loans = loansData?.loans || []

 return (
 <div className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center mb-2"><Boxes className="h-4 w-4 text-blue-700 dark:text-blue-300" /></div><div className="text-xs text-muted-foreground">Total Items</div><div className="text-xl font-bold">{summary.totalItems}</div></CardContent></Card>
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-2"><Package className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /></div><div className="text-xs text-muted-foreground">Available</div><div className="text-xl font-bold">{summary.available}</div></CardContent></Card>
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-2"><ArrowRightLeft className="h-4 w-4 text-amber-700 dark:text-amber-300" /></div><div className="text-xs text-muted-foreground">Out on Loan</div><div className="text-xl font-bold">{summary.outOnLoan}</div></CardContent></Card>
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center mb-2"><DollarSign className="h-4 w-4 text-purple-700 dark:text-purple-300" /></div><div className="text-xs text-muted-foreground">Total Value</div><div className="text-xl font-bold">{formatCurrency(summary.totalValue)}</div></CardContent></Card>
 </div>

 <Tabs defaultValue="items">
 <div className="flex items-center justify-between">
 <TabsList>
 <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
 <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
 </TabsList>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Item</Button>
 </div>

 <TabsContent value="items" className="mt-4">
 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
 ) : items.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
 <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
 No inventory items yet. Add uniforms, equipment, instruments, books, and more.
 </CardContent></Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {items.map(item => (
 <Card key={item.id}>
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="text-3xl">{inventoryCategoryEmoji(item.category)}</div>
 <Badge style={{ backgroundColor: itemConditionColor(item.condition) + '20', color: itemConditionColor(item.condition) }}>{itemConditionLabel(item.condition)}</Badge>
 </div>
 <CardTitle className="text-base mt-1">{item.name}</CardTitle>
 <CardDescription className="line-clamp-1">{item.description || item.location || 'No description'}</CardDescription>
 </CardHeader>
 <CardContent className="pt-0 text-xs space-y-1">
 <div className="flex justify-between"><span>Quantity:</span><span className="font-medium">{item.quantityAvailable}/{item.quantity}</span></div>
 {item.currentValue && <div className="flex justify-between"><span>Value:</span><span className="font-medium">{formatCurrency(item.currentValue)}</span></div>}
 {item.location && <div className="flex justify-between"><span>Location:</span><span>{item.location}</span></div>}
 {item.isLoanable && item.quantityAvailable > 0 && (
 <Button size="sm" className="w-full mt-2" onClick={() => setLoanFor(item.id)}><ArrowRightLeft className="h-3 w-3 mr-1" /> Check Out</Button>
 )}
 {item.isLoanable && item.quantityAvailable === 0 && (
 <Badge variant="outline" className="w-full justify-center text-foreground mt-2">All checked out</Badge>
 )}
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="loans" className="mt-4 space-y-2">
 {loans.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">No active loans</CardContent></Card>
 ) : loans.map(loan => (
 <Card key={loan.id}>
 <CardContent className="p-3 flex items-center gap-3">
 <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">{inventoryCategoryEmoji(loan.item.category)}</div>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm">{loan.item.name}</div>
 <div className="text-xs text-muted-foreground">
 {loan.user.name} · checked out {formatDate(loan.checkoutDate)} · due {formatDate(loan.dueDate)}
 {loan.returnedDate && ` · returned ${formatDate(loan.returnedDate)}`}
 </div>
 </div>
 <Badge style={{ backgroundColor: loanStatusColor(loan.status) + '20', color: loanStatusColor(loan.status) }}>{loanStatusLabel(loan.status)}</Badge>
 {loan.status === 'OUT' && (
 <Button size="sm" variant="outline" onClick={async () => {
 await apiPatch('/api/inventory/loans', { loanId: loan.id, conditionAtReturn: 'GOOD' })
 toast.success('Item returned')
 refetchLoans()
 refetch()
 }}><ArrowRightLeft className="h-3 w-3 mr-1" /> Return</Button>
 )}
 </CardContent>
 </Card>
 ))}
 </TabsContent>
 </Tabs>

 <CreateItemDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => { refetch(); setCreateOpen(false) }} />
 {loanFor && <CheckoutDialog itemId={loanFor} clubId={clubId} onClose={() => setLoanFor(null)} onDone={() => { refetch(); refetchLoans(); setLoanFor(null) }} />}
 </div>
 )
}

function CreateItemDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 name: '',
 description: '',
 category: 'equipment',
 quantity: '1',
 condition: 'NEW',
 location: '',
 purchasePrice: '',
 currentValue: '',
 isLoanable: true,
 loanPeriodDays: 7,
 depositAmount: '0',
 })

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 await apiPost('/api/inventory', {
 ...form,
 clubId,
 quantity: parseInt(form.quantity) || 1,
 purchasePrice: form.purchasePrice || null,
 currentValue: form.currentValue || null,
 depositAmount: parseFloat(form.depositAmount) || 0,
 })
 toast.success('Item added')
 onCreated()
 setForm({ ...form, name: '', description: '', location: '', purchasePrice: '', currentValue: '' })
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" /> New Inventory Item</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Canon Camera #1" /></div>
 <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Category</Label>
 <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{INVENTORY_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div>
 <Label>Condition</Label>
 <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{ITEM_CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
 <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Storage closet" /></div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Purchase Price ($)</Label><Input type="number" step="0.01" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} /></div>
 <div><Label>Current Value ($)</Label><Input type="number" step="0.01" value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })} /></div>
 </div>
 <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.isLoanable} onCheckedChange={(v) => setForm({ ...form, isLoanable: !!v })} /> Loanable to members</label>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Add Item</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function CheckoutDialog({ itemId, clubId, onClose, onDone }: any) {
 const [form, setForm] = useState({
 userId: '',
 loanDays: 7,
 notes: '',
 })
 const { data: membersData } = useFetch<{ members: any[] }>(clubId !== 'ALL' ? `/api/members?clubId=${clubId}` : '/api/members')

 const submit = async () => {
 try {
 if (!form.userId) { toast.error('Select a member'); return }
 await apiPost(`/api/inventory/${itemId}/loans`, form)
 toast.success('Item checked out')
 onDone()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open onOpenChange={onClose}>
 <DialogContent>
 <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Check Out Item</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div>
 <Label>Borrower</Label>
 <Select value={form.userId} onValueChange={v => setForm({ ...form, userId: v })}>
 <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
 <SelectContent>{(membersData?.members || []).map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.user.name}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div><Label>Loan Period (days)</Label><Input type="number" value={form.loanDays} onChange={e => setForm({ ...form, loanDays: parseInt(e.target.value) || 7 })} /></div>
 <div><Label>Notes (optional)</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={onClose}>Cancel</Button>
 <Button onClick={submit}>Check Out</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
