'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
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
import { DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Receipt, PiggyBank, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { TRANSACTION_TYPES, TRANSACTION_CATEGORIES, PAYMENT_METHODS, transactionTypeLabel, transactionTypeColor, transactionCategoryEmoji, formatCurrency, formatDate } from '@/lib/clubhub/types'
import { toast } from 'sonner'

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6b7280']

export function FinanceTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/finance?clubId=${clubId}` : '/api/finance'
 const { data, loading, refetch } = useFetch<any>(url)
 const [createOpen, setCreateOpen] = useState(false)

 const summary = data?.summary || { income: 0, expenses: 0, balance: 0, pendingDues: 0, transactionCount: 0 }
 const monthly = data?.monthly || []
 const byCategory = data?.byCategory || {}
 const transactions = data?.transactions || []
 const budgets = data?.budgets || []

 const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value: Math.abs(value as number) }))

 return (
 <div className="space-y-6">
 {/* KPI cards */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <KpiCard label="Balance" value={formatCurrency(summary.balance)} icon={<Wallet className="h-4 w-4" />} color="bg-muted text-foreground" />
 <KpiCard label="Total Income" value={formatCurrency(summary.income)} icon={<TrendingUp className="h-4 w-4" />} color="bg-muted text-foreground" />
 <KpiCard label="Total Expenses" value={formatCurrency(summary.expenses)} icon={<TrendingDown className="h-4 w-4" />} color="bg-muted text-foreground" />
 <KpiCard label="Pending Dues" value={formatCurrency(summary.pendingDues)} icon={<AlertCircle className="h-4 w-4" />} color="bg-muted text-foreground" />
 </div>

 <Tabs defaultValue="overview" className="space-y-4">
 <TabsList>
 <TabsTrigger value="overview">Overview</TabsTrigger>
 <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
 <TabsTrigger value="budgets">Budgets</TabsTrigger>
 </TabsList>

 <TabsContent value="overview" className="space-y-4">
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between">
 <CardTitle className="text-base">Monthly Cash Flow</CardTitle>
 {transactions.length === 0 && (
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Transaction</Button>
 )}
 </CardHeader>
 <CardContent>
 {monthly.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No transactions yet — click "New Transaction" to get started.</div>
 ) : (
 <ResponsiveContainer width="100%" height={260}>
 <BarChart data={monthly}>
 <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
 <XAxis dataKey="month" tick={{ fontSize: 11 }} />
 <YAxis tick={{ fontSize: 11 }} />
 <Tooltip formatter={(v: number) => formatCurrency(v)} />
 <Legend />
 <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
 <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader><CardTitle className="text-base">Spending by Category</CardTitle></CardHeader>
 <CardContent>
 {pieData.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No data</div>
 ) : (
 <ResponsiveContainer width="100%" height={260}>
 <PieChart>
 <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.name}>
 {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
 </Pie>
 <Tooltip formatter={(v: number) => formatCurrency(v)} />
 </PieChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>
 </div>
 </TabsContent>

 <TabsContent value="transactions" className="space-y-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between">
 <div>
 <CardTitle className="text-base">All Transactions</CardTitle>
 <CardDescription>{transactions.length} records</CardDescription>
 </div>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Transaction</Button>
 </CardHeader>
 <CardContent>
 {loading ? (
 <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
 ) : transactions.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-12">No transactions yet. Click"New Transaction" to record income or expenses.</div>
 ) : (
 <div className="space-y-1.5">
 {transactions.map((t: any) => (
 <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30">
 <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: transactionTypeColor(t.type) + '20' }}>
 {transactionCategoryEmoji(t.category)}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{t.description || t.category}</div>
 <div className="text-xs text-muted-foreground flex items-center gap-2">
 <span>{formatDate(t.date)}</span>
 <span>·</span>
 <Badge variant="outline" className="text-[10px]" style={{ color: transactionTypeColor(t.type) }}>{transactionTypeLabel(t.type)}</Badge>
 {t.paymentMethod && <><span>·</span><span>{t.paymentMethod}</span></>}
 {t.recordedBy && <><span>·</span><span>by {t.recordedBy.name}</span></>}
 </div>
 </div>
 <div className={`font-mono font-semibold ${t.type === 'EXPENSE' || t.type === 'REFUND' ? 'text-foreground' : 'text-foreground'}`}>
 {t.type === 'EXPENSE' || t.type === 'REFUND' ? '-' : '+'}{formatCurrency(t.amount)}
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="budgets" className="space-y-4">
 <Card>
 <CardHeader><CardTitle className="text-base">Budgets</CardTitle></CardHeader>
 <CardContent>
 {budgets.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No budgets defined yet</div>
 ) : (
 <div className="space-y-3">
 {budgets.map((b: any) => {
 const pct = b.allocated > 0 ? (b.spent / b.allocated) * 100 : 0
 return (
 <div key={b.id} className="space-y-1">
 <div className="flex items-center justify-between text-sm">
 <div className="font-medium">{b.name}</div>
 <div className="text-muted-foreground">{formatCurrency(b.spent)} / {formatCurrency(b.allocated)}</div>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <div className={`h-full ${pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
 </div>
 </div>
 )
 })}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 <CreateTransactionDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => { refetch(); setCreateOpen(false) }} />
 </div>
 )
}

function KpiCard({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) {
 return (
 <Card>
 <CardContent className="p-4">
 <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>{icon}</div>
 <div className="text-xs text-muted-foreground">{label}</div>
 <div className="text-xl font-bold">{value}</div>
 </CardContent>
 </Card>
 )
}

function CreateTransactionDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 type: 'EXPENSE',
 category: 'supplies',
 amount: '',
 description: '',
 paymentMethod: 'cash',
 date: new Date().toISOString().split('T')[0],
 })

 const submit = async () => {
 try {
 if (clubId === 'ALL') {
 toast.error('Please select a specific club first')
 return
 }
 await apiPost('/api/finance', { ...form, clubId, amount: parseFloat(form.amount) })
 toast.success('Transaction recorded')
 onCreated()
 } catch (e: any) {
 toast.error(e.message)
 }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> New Transaction</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Type</Label>
 <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{TRANSACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div>
 <Label>Category</Label>
 <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{TRANSACTION_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 </div>
 <div>
 <Label>Amount (USD)</Label>
 <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
 </div>
 <div>
 <Label>Description</Label>
 <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What was this for?" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Payment Method</Label>
 <Select value={form.paymentMethod} onValueChange={v => setForm({ ...form, paymentMethod: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div>
 <Label>Date</Label>
 <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Record Transaction</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
