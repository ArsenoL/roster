'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Calendar, TrendingUp, Plus, Search, Settings, Mail, MapPin, Clock, Crown, Pencil, Trash2 } from 'lucide-react'
import { CLUB_CATEGORIES, categoryEmoji, categoryLabel, type Club } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function ClubsTab({ onNavigateToSettings }: { onNavigateToSettings: (clubId: string) => void }) {
 const { data, loading, refetch } = useFetch<{ clubs: Club[] }>('/api/clubs')
 const [search, setSearch] = useState('')
 const [categoryFilter, setCategoryFilter] = useState('ALL')
 const [createOpen, setCreateOpen] = useState(false)
 const [editClub, setEditClub] = useState<Club | null>(null)

 const clubs = (data?.clubs || []).filter(c => {
 if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
 if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false
 return true
 })

 return (
 <div className="space-y-4">
 <div className="flex flex-wrap items-center gap-3">
 <div className="relative flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search clubs..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="pl-9"
 />
 </div>
 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
 <SelectTrigger className="w-[180px]">
 <SelectValue placeholder="Category" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Categories</SelectItem>
 {CLUB_CATEGORIES.map(c => (
 <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Button onClick={() => setCreateOpen(true)}>
 <Plus className="h-4 w-4" /> New Club
 </Button>
 </div>

 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
 </div>
 ) : clubs.length === 0 ? (
 <Card>
 <CardContent className="py-16 text-center text-muted-foreground">
 No clubs found. Create one to get started.
 </CardContent>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {clubs.map(club => (
 <ClubCard
 key={club.id}
 club={club}
 onEdit={() => setEditClub(club)}
 onSettings={() => onNavigateToSettings(club.id)}
 onDelete={async () => {
 if (!confirm(`Delete ${club.name}? This will remove all related data.`)) return
 try {
 await apiDelete(`/api/clubs/${club.id}`)
 toast.success('Club deleted')
 refetch()
 } catch (e: any) {
 // Silent errors are 401-recovery redirects — don't show a toast,
 // the user is already being sent to /login.
 if (!e?.silent) toast.error(e.message)
 }
 }}
 />
 ))}
 </div>
 )}

 <ClubDialog
 open={createOpen}
 onOpenChange={setCreateOpen}
 onSave={async (data) => {
 try {
 await apiPost('/api/clubs', data)
 toast.success('Club created')
 setCreateOpen(false)
 refetch()
 } catch (e: any) {
 // Silent errors are 401-recovery redirects — don't show a toast,
 // the user is already being sent to /login. Previously this just
 // toasted e.message verbatim, which on a stale-session 401 was
 // "Sign in to create a club" — confusing nonsense to a user who
 // could see their own name in the top-right corner.
 if (!e?.silent) toast.error(e.message)
 }
 }}
 />

 <ClubDialog
 open={!!editClub}
 onOpenChange={(o) => !o && setEditClub(null)}
 club={editClub}
 onSave={async (data) => {
 if (!editClub) return
 try {
 const r = await fetch(`/api/clubs/${editClub.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(data)
 })
 if (!r.ok) throw new Error('Failed to update')
 toast.success('Club updated')
 setEditClub(null)
 refetch()
 } catch (e: any) {
 toast.error(e.message)
 }
 }}
 />
 </div>
 )
}

function ClubCard({ club, onEdit, onSettings, onDelete }: {
 club: Club
 onEdit: () => void
 onSettings: () => void
 onDelete: () => void
}) {
 return (
 <Card className="overflow-hidden group">
 <div
 className="h-2"
 style={{ background: `linear-gradient(to right, ${club.primaryColor}, ${club.accentColor})` }}
 />
 <CardHeader>
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-3 min-w-0">
 <div
 className="flex items-center justify-center w-12 h-12 text-2xl shrink-0"
 style={{ backgroundColor: `${club.primaryColor}20` }}
 >
 {categoryEmoji(club.category)}
 </div>
 <div className="min-w-0">
 <CardTitle className="text-base truncate">{club.name}</CardTitle>
 <CardDescription className="flex items-center gap-2 text-xs">
 <Badge variant="outline" className="text-[10px]">{categoryLabel(club.category)}</Badge>
 {club.status === 'ACTIVE' ? (
 <span className="text-foreground">● Active</span>
 ) : (
 <span className="text-muted-foreground">● {club.status}</span>
 )}
 </CardDescription>
 </div>
 </div>
 <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
 <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSettings}>
 <Settings className="h-3.5 w-3.5" />
 </Button>
 <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-foreground" onClick={onDelete}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <p className="text-sm text-muted-foreground line-clamp-2">{club.description}</p>

 <div className="grid grid-cols-3 gap-2 pt-2">
 <div className="text-center p-2 rounded-lg bg-muted/50">
 <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
 <div className="text-lg font-bold">{club.activeMembers ?? 0}</div>
 <div className="text-[10px] text-muted-foreground">Members</div>
 </div>
 <div className="text-center p-2 rounded-lg bg-muted/50">
 <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
 <div className="text-lg font-bold">{club.totalEvents ?? 0}</div>
 <div className="text-[10px] text-muted-foreground">Events</div>
 </div>
 <div className="text-center p-2 rounded-lg bg-muted/50">
 <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
 <div className="text-lg font-bold" style={{ color: club.attendanceRate && club.attendanceRate > 75 ? '#10b981' : club.attendanceRate && club.attendanceRate > 50 ? '#f59e0b' : '#ef4444' }}>
 {club.attendanceRate ?? 0}%
 </div>
 <div className="text-[10px] text-muted-foreground">Attendance</div>
 </div>
 </div>

 <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
 {club.advisor && (
 <div className="flex items-center gap-2">
 <Mail className="h-3 w-3" /> {club.advisor.name}
 </div>
 )}
 {club.meetingRoom && (
 <div className="flex items-center gap-2">
 <MapPin className="h-3 w-3" /> {club.meetingRoom}
 </div>
 )}
 {club.defaultDay && (
 <div className="flex items-center gap-2">
 <Clock className="h-3 w-3" /> {club.defaultDay}s at {club.defaultTime}
 </div>
 )}
 {club.president && (
 <div className="flex items-center gap-2">
 <Crown className="h-3 w-3" /> {club.president.name}
 </div>
 )}
 </div>

 <div className="flex items-center justify-between pt-2 border-t">
 <div className="text-xs text-muted-foreground">
 Capacity: {club.capacity} · Dues: ${club.dues}
 </div>
 <Button size="sm" variant="outline" onClick={onSettings}>
 <Settings className="h-3 w-3 mr-1" /> Configure
 </Button>
 </div>
 </CardContent>
 </Card>
 )
}

function ClubDialog({ open, onOpenChange, onSave, club }: {
 open: boolean
 onOpenChange: (open: boolean) => void
 onSave: (data: any) => void
 club?: Club | null
}) {
 const [form, setForm] = useState<any>(club || {
 name: '',
 description: '',
 category: 'OTHER',
 primaryColor: '#10b981',
 accentColor: '#6366f1',
 meetingRoom: '',
 defaultDay: 'TUESDAY',
 defaultTime: '15:30',
 capacity: 50,
 dues: 0,
 isPublic: true,
 requireApproval: false,
 })

 // Reset form when club changes
 useState(() => {
 if (club) setForm(club)
 })

 const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
 const presetColors = ['#10b981', '#6366f1', '#ec4899', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#a855f7']

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{club ? 'Edit Club' : 'Create New Club'}</DialogTitle>
 <DialogDescription>
 {club ? 'Update club details and branding.' : 'Set up a new club with custom branding and meeting defaults.'}
 </DialogDescription>
 </DialogHeader>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
 <div className="md:col-span-2">
 <Label htmlFor="name">Club Name</Label>
 <Input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Robotics & Engineering Society" />
 </div>

 <div className="md:col-span-2">
 <Label htmlFor="description">Description</Label>
 <Textarea id="description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What is this club about?" />
 </div>

 <div>
 <Label>Category</Label>
 <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {CLUB_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label>Meeting Day</Label>
 <Select value={form.defaultDay} onValueChange={v => setForm({ ...form, defaultDay: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {days.map(d => <SelectItem key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label>Meeting Time</Label>
 <Input type="time" value={form.defaultTime || ''} onChange={e => setForm({ ...form, defaultTime: e.target.value })} />
 </div>

 <div>
 <Label>Meeting Room</Label>
 <Input value={form.meetingRoom || ''} onChange={e => setForm({ ...form, meetingRoom: e.target.value })} placeholder="e.g., Lab 204" />
 </div>

 <div>
 <Label>Capacity</Label>
 <Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
 </div>

 <div>
 <Label>Dues ($)</Label>
 <Input type="number" value={form.dues} onChange={e => setForm({ ...form, dues: parseFloat(e.target.value) || 0 })} />
 </div>

 <div>
 <Label>Primary Color</Label>
 <div className="flex flex-wrap gap-2">
 {presetColors.map(c => (
 <button
 key={c}
 type="button"
 onClick={() => setForm({ ...form, primaryColor: c })}
 className={`w-8 h-8 rounded-full border-2 ${form.primaryColor === c ? 'border-foreground' : 'border-transparent'}`}
 style={{ backgroundColor: c }}
 />
 ))}
 </div>
 </div>

 <div>
 <Label>Accent Color</Label>
 <div className="flex flex-wrap gap-2">
 {presetColors.map(c => (
 <button
 key={c}
 type="button"
 onClick={() => setForm({ ...form, accentColor: c })}
 className={`w-8 h-8 rounded-full border-2 ${form.accentColor === c ? 'border-foreground' : 'border-transparent'}`}
 style={{ backgroundColor: c }}
 />
 ))}
 </div>
 </div>

 <div className="md:col-span-2 flex items-center gap-6 pt-2">
 <div className="flex items-center gap-2">
 <Switch checked={form.isPublic} onCheckedChange={v => setForm({ ...form, isPublic: v })} id="public" />
 <Label htmlFor="public">Public club</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch checked={form.requireApproval} onCheckedChange={v => setForm({ ...form, requireApproval: v })} id="approval" />
 <Label htmlFor="approval">Require approval to join</Label>
 </div>
 </div>
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={() => onSave(form)} disabled={!form.name}>
 {club ? 'Save Changes' : 'Create Club'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
