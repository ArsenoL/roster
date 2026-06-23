'use client'

import { useState, useMemo, useEffect } from 'react'
import { useFetch, apiPost, apiPatch, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
 Search, Plus, Upload, Download, MoreHorizontal, Filter, Users, Trash2,
 Mail, Phone, GraduationCap, Home, Flame, Trophy, ChevronLeft, ChevronRight, UserPlus, FileUp
} from 'lucide-react'
import {
 MEMBERSHIP_ROLES, type Member, avatarColor, initials, formatDate
} from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function MembersTab({ clubId }: { clubId: string }) {
 const [search, setSearch] = useState('')
 const [roleFilter, setRoleFilter] = useState('ALL')
 const [gradeFilter, setGradeFilter] = useState('ALL')
 const [statusFilter, setStatusFilter] = useState('ACTIVE')
 const [page, setPage] = useState(0)
 const [pageSize] = useState(25)
 const [selected, setSelected] = useState<Set<string>>(new Set())
 const [addOpen, setAddOpen] = useState(false)
 const [importOpen, setImportOpen] = useState(false)
 const [bulkSubmitting, setBulkSubmitting] = useState(false)

 // Reset selection + pagination when the club changes — otherwise stale
 // selections from club A get applied to club B's members.
 useEffect(() => {
 setSelected(new Set())
 setPage(0)
 }, [clubId])

 const url = useMemo(() => `/api/members?clubId=${clubId}&search=${encodeURIComponent(search)}&role=${roleFilter}&grade=${gradeFilter}&status=${statusFilter}&limit=${pageSize}&offset=${page * pageSize}`, [clubId, search, roleFilter, gradeFilter, statusFilter, pageSize, page])
 const { data, loading, refetch } = useFetch<{ members: Member[], total: number }>(clubId === 'ALL' ? null : url)

 const members = data?.members || []
 const total = data?.total || 0
 const totalPages = Math.ceil(total / pageSize)

 const toggleSelect = (id: string) => {
 const next = new Set(selected)
 if (next.has(id)) next.delete(id)
 else next.add(id)
 setSelected(next)
 }

 const toggleSelectAll = () => {
 if (selected.size === members.length) {
 setSelected(new Set())
 } else {
 setSelected(new Set(members.map(m => m.id)))
 }
 }

 const handleExport = () => {
 window.open(`/api/export?type=members&clubId=${clubId}`, '_blank')
 toast.success('Exporting CSV...')
 }

 const handleBulkRoleChange = async (role: string) => {
 if (selected.size === 0) return
 setBulkSubmitting(true)
 try {
 const results = await Promise.allSettled(
 Array.from(selected).map(id => apiPatch(`/api/members/${id}`, { role }))
 )
 const succeeded = results.filter(r => r.status === 'fulfilled').length
 const failed = results.length - succeeded
 if (failed === 0) toast.success(`Updated ${succeeded} members to ${role}`)
 else if (succeeded === 0) toast.error(`Failed to update all ${failed} members`)
 else toast.warning(`Updated ${succeeded}, failed ${failed}`)
 setSelected(new Set())
 refetch()
 } finally {
 setBulkSubmitting(false)
 }
 }

 if (clubId === 'ALL') {
 return (
 <Card>
 <CardContent className="py-16 text-center text-muted-foreground">
 <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>Select a specific club from the sidebar to manage its members.</p>
 </CardContent>
 </Card>
 )
 }

 return (
 <div className="space-y-4">
 {/* Filters */}
 <div className="flex flex-wrap items-center gap-3">
 <div className="relative flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Search by name, email, student ID..."
 value={search}
 onChange={(e) => { setSearch(e.target.value); setPage(0) }}
 className="pl-9"
 />
 </div>
 <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0) }}>
 <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Roles</SelectItem>
 {MEMBERSHIP_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setPage(0) }}>
 <SelectTrigger className="w-[120px]"><SelectValue placeholder="Grade" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Grades</SelectItem>
 {[9, 10, 11, 12].map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
 </SelectContent>
 </Select>
 <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
 <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Status</SelectItem>
 <SelectItem value="ACTIVE">Active</SelectItem>
 <SelectItem value="PROBATIONARY">Probationary</SelectItem>
 <SelectItem value="ALUMNI">Alumni</SelectItem>
 <SelectItem value="REMOVED">Removed</SelectItem>
 </SelectContent>
 </Select>
 <Button variant="outline" onClick={handleExport}>
 <Download className="h-4 w-4" /> Export
 </Button>
 <Button variant="outline" onClick={() => setImportOpen(true)}>
 <Upload className="h-4 w-4" /> Import CSV
 </Button>
 <Button onClick={() => setAddOpen(true)}>
 <UserPlus className="h-4 w-4" /> Add Member
 </Button>
 </div>

 {/* Bulk actions bar */}
 {selected.size > 0 && (
 <Card className="border-primary">
 <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
 <div className="text-sm font-medium">
 {selected.size} member{selected.size !== 1 ? 's' : ''} selected
 </div>
 <div className="flex gap-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm" disabled={bulkSubmitting}>
 <Filter className="h-3.5 w-3.5" /> Change Role
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent>
 <DropdownMenuLabel>Set role to...</DropdownMenuLabel>
 <DropdownMenuSeparator />
 {MEMBERSHIP_ROLES.map(r => (
 <DropdownMenuItem key={r.value} onClick={() => handleBulkRoleChange(r.value)} disabled={bulkSubmitting}>
 {r.label}
 </DropdownMenuItem>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>
 <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
 Clear
 </Button>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Members table */}
 <Card>
 <CardContent className="p-0">
 {loading ? (
 <div className="p-4 space-y-2">
 {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
 </div>
 ) : members.length === 0 ? (
 <div className="py-16 text-center text-muted-foreground">
 <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>No members found. Try adjusting filters or add new members.</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="border-b bg-muted/30">
 <tr>
 <th className="w-10 p-3 text-left">
 <Checkbox
 checked={selected.size === members.length && members.length > 0}
 onCheckedChange={toggleSelectAll}
 />
 </th>
 <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</th>
 <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Grade</th>
 <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
 <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Attendance</th>
 <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Streak</th>
 <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Points</th>
 <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Joined</th>
 <th className="w-10"></th>
 </tr>
 </thead>
 <tbody>
 {members.map((m) => (
 <tr key={m.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
 <td className="p-3">
 <Checkbox
 checked={selected.has(m.id)}
 onCheckedChange={() => toggleSelect(m.id)}
 />
 </td>
 <td className="p-3">
 <div className="flex items-center gap-3">
 <Avatar className="h-9 w-9" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-xs font-medium">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <div className="font-medium text-sm truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
 </div>
 </div>
 </td>
 <td className="p-3 hidden md:table-cell">
 {m.user.grade && (
 <Badge variant="outline" className="text-xs">G{m.user.grade}</Badge>
 )}
 </td>
 <td className="p-3">
 <Badge
 variant={m.role === 'PRESIDENT' || m.role === 'VICE_PRESIDENT' ? 'default' : 'secondary'}
 className="text-xs"
 >
 {MEMBERSHIP_ROLES.find(r => r.value === m.role)?.label || m.role}
 </Badge>
 </td>
 <td className="p-3 hidden lg:table-cell">
 <div className="flex items-center gap-2">
 <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
 <div
 className="h-full rounded-full transition-all"
 style={{
 width: `${m.attendanceRate || 0}%`,
 backgroundColor: (m.attendanceRate || 0) > 75 ? '#10b981' : (m.attendanceRate || 0) > 50 ? '#f59e0b' : '#ef4444'
 }}
 />
 </div>
 <span className="text-xs text-muted-foreground">{m.attendanceRate || 0}%</span>
 </div>
 </td>
 <td className="p-3 hidden md:table-cell">
 <div className="flex items-center gap-1 text-sm">
 <Flame className="h-3.5 w-3.5 text-foreground" />
 {m.streak}
 </div>
 </td>
 <td className="p-3 hidden lg:table-cell">
 <div className="flex items-center gap-1 text-sm">
 <Trophy className="h-3.5 w-3.5 text-foreground" />
 {m.points}
 </div>
 </td>
 <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground">
 {formatDate(m.joinedAt)}
 </td>
 <td className="p-3">
 <MemberMenu member={m} onRemoved={() => refetch()} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Pagination */}
 {total > pageSize && (
 <div className="flex items-center justify-between">
 <div className="text-sm text-muted-foreground">
 Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
 </div>
 <div className="flex gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => setPage(p => Math.max(0, p - 1))}
 disabled={page === 0}
 >
 <ChevronLeft className="h-4 w-4" />
 </Button>
 <div className="flex items-center px-3 text-sm">
 Page {page + 1} of {totalPages}
 </div>
 <Button
 size="sm"
 variant="outline"
 onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
 disabled={page >= totalPages - 1}
 >
 <ChevronRight className="h-4 w-4" />
 </Button>
 </div>
 </div>
 )}

 <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} clubId={clubId} onAdded={() => refetch()} />
 <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} clubId={clubId} onImported={() => refetch()} />
 </div>
 )
}

function MemberMenu({ member, onRemoved }: { member: Member, onRemoved: () => void }) {
 return (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button size="icon" variant="ghost" className="h-8 w-8">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuLabel>{member.user.name}</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => navigator.clipboard.writeText(member.user.email)}>
 <Mail className="h-3.5 w-3.5 mr-2" /> Copy email
 </DropdownMenuItem>
 {member.user.phone && (
 <DropdownMenuItem onClick={() => navigator.clipboard.writeText(member.user.phone!)}>
 <Phone className="h-3.5 w-3.5 mr-2" /> Copy phone
 </DropdownMenuItem>
 )}
 <DropdownMenuSeparator />
 <DropdownMenuItem className="text-foreground" onClick={async () => {
 if (!confirm(`Remove ${member.user.name} from this club?`)) return
 try {
 await apiDelete(`/api/members?id=${member.id}`)
 toast.success('Member removed')
 onRemoved()
 } catch (e: any) {
 toast.error(e.message)
 }
 }}>
 <Trash2 className="h-3.5 w-3.5 mr-2" /> Remove
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 )
}

function AddMemberDialog({ open, onOpenChange, clubId, onAdded }: {
 open: boolean
 onOpenChange: (o: boolean) => void
 clubId: string
 onAdded: () => void
}) {
 const [form, setForm] = useState({
 name: '', email: '', studentId: '', grade: '9', graduationYear: '2029',
 house: '', phone: '', pronouns: '', role: 'MEMBER'
 })

 const handleSubmit = async () => {
 try {
 await apiPost('/api/members', { ...form, clubId })
 toast.success('Member added')
 setForm({ name: '', email: '', studentId: '', grade: '9', graduationYear: '2029', house: '', phone: '', pronouns: '', role: 'MEMBER' })
 onOpenChange(false)
 onAdded()
 } catch (e: any) {
 toast.error(e.message)
 }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Add Member</DialogTitle>
 <DialogDescription>Register a new member for this club.</DialogDescription>
 </DialogHeader>
 <div className="grid grid-cols-2 gap-3 py-2">
 <div className="col-span-2">
 <Label>Full Name *</Label>
 <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
 </div>
 <div className="col-span-2">
 <Label>Email *</Label>
 <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
 </div>
 <div>
 <Label>Student ID</Label>
 <Input value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} />
 </div>
 <div>
 <Label>Role</Label>
 <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {MEMBERSHIP_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Grade</Label>
 <Select value={form.grade} onValueChange={v => setForm({ ...form, grade: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {[9, 10, 11, 12].map(g => <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Graduation Year</Label>
 <Input value={form.graduationYear} onChange={e => setForm({ ...form, graduationYear: e.target.value })} />
 </div>
 <div>
 <Label>House</Label>
 <Input value={form.house} onChange={e => setForm({ ...form, house: e.target.value })} placeholder="e.g., Athena" />
 </div>
 <div>
 <Label>Pronouns</Label>
 <Input value={form.pronouns} onChange={e => setForm({ ...form, pronouns: e.target.value })} placeholder="she/her, he/him, they/them" />
 </div>
 <div className="col-span-2">
 <Label>Phone</Label>
 <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={handleSubmit} disabled={!form.name || !form.email}>Add Member</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function ImportCsvDialog({ open, onOpenChange, clubId, onImported }: {
 open: boolean
 onOpenChange: (o: boolean) => void
 clubId: string
 onImported: () => void
}) {
 const [csvText, setCsvText] = useState('')
 const [importing, setImporting] = useState(false)
 const [result, setResult] = useState<any>(null)

 const parseCsv = (text: string): any[] => {
 // RFC 4180–aware parser: handles quoted fields, escaped quotes, and
 // commas embedded inside quoted values. The previous `line.split(',')`
 // mangled any row containing a comma (e.g. "Lee, Dana").
 const parseCSVLine = (line: string): string[] => {
 const out: string[] = []
 let cur = ''
 let inQuotes = false
 for (let i = 0; i < line.length; i++) {
 const c = line[i]
 if (inQuotes) {
 if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
 else if (c === '"') { inQuotes = false }
 else { cur += c }
 } else {
 if (c === '"') { inQuotes = true }
 else if (c === ',') { out.push(cur); cur = '' }
 else { cur += c }
 }
 }
 out.push(cur)
 return out
 }
 const lines = text.trim().split(/\r?\n/)
 if (lines.length < 2) return []
 const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())
 return lines.slice(1).map(line => {
 const values = parseCSVLine(line).map(v => v.trim())
 const obj: any = {}
 headers.forEach((h, i) => { obj[h] = values[i] })
 return obj
 })
 }

 const handleImport = async () => {
 setImporting(true)
 try {
 const members = parseCsv(csvText)
 if (members.length === 0) {
 toast.error('No valid rows found')
 return
 }
 const r = await apiPost('/api/members/bulk-import', { clubId, members })
 setResult(r)
 toast.success(`Imported ${r.created} new, ${r.existing} existing`)
 onImported()
 } catch (e: any) {
 toast.error(e.message)
 } finally {
 setImporting(false)
 }
 }

 const loadSample = () => {
 setCsvText(`name,email,studentId,grade,graduationYear,house,phone,role
Aiden Park,aiden.park@student.school.edu,S10050,10,2028,Athena,+15551234567,MEMBER
Brianna Chen,brianna.chen@student.school.edu,S10051,11,2027,Apollo,+15551234568,MEMBER
Carlos Mendez,carlos.mendez@student.school.edu,S10052,9,2029,Hermes,+15551234569,MEMBER
Dana Lee,dana.lee@student.school.edu,S10053,12,2026,Artemis,+15551234570,COMMITTEE_HEAD`)
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Bulk Import Members (CSV)</DialogTitle>
 <DialogDescription>
 Paste CSV with columns: name, email, studentId, grade, graduationYear, house, phone, role
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div className="flex justify-between items-center">
 <Label>CSV Data</Label>
 <Button size="sm" variant="ghost" onClick={loadSample}>
 <FileUp className="h-3.5 w-3.5 mr-1" /> Load Sample
 </Button>
 </div>
 <textarea
 className="w-full min-h-[200px] p-3 text-xs font-mono rounded-md border border-input bg-background"
 value={csvText}
 onChange={(e) => setCsvText(e.target.value)}
 placeholder="name,email,studentId,grade,..."
 />
 {result && (
 <Card>
 <CardContent className="p-3 text-sm">
 <div className="font-medium mb-2">Import Results:</div>
 <div className="grid grid-cols-3 gap-2">
 <div className="text-center">
 <div className="text-2xl font-bold text-foreground">{result.created}</div>
 <div className="text-xs text-muted-foreground">Created</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold text-foreground">{result.existing}</div>
 <div className="text-xs text-muted-foreground">Already Existing</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold text-foreground">{result.errors}</div>
 <div className="text-xs text-muted-foreground">Errors</div>
 </div>
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
 <Button onClick={handleImport} disabled={importing || !csvText}>
 {importing ? 'Importing...' : 'Import Members'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
