'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, GraduationCap, PartyPopper, Mail, Send, UserCheck } from 'lucide-react'
import { avatarColor, initials } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function InvitesTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/invites?clubId=${clubId}` : '/api/invites'
 const { data, loading, refetch } = useFetch<{ invites: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)

 const invites = data?.invites || []

 async function copyInviteLink(token: string) {
 const baseUrl = window.location.origin
 await navigator.clipboard.writeText(`${baseUrl}/join/${token}`)
 toast.success('Invite link copied')
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Member Invites</h2>
 <p className="text-sm text-muted-foreground">Send real email invites with magic-link tokens. Track who's accepted.</p>
 </div>
 <Button onClick={() => setCreateOpen(true)} disabled={clubId === 'ALL'}><Plus className="h-4 w-4" /> Send invites</Button>
 </div>

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
 ) : invites.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No invites sent yet.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {invites.map((i) => (
 <Card key={i.id}>
 <CardContent className="p-4 flex items-center gap-3 flex-wrap">
 <Avatar className="h-10 w-10" style={{ backgroundColor: avatarColor(i.email) }}>
 <AvatarFallback className="text-white text-xs">{initials(i.email.split('@')[0])}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-[200px]">
 <div className="font-medium">{i.email}</div>
 <div className="text-xs text-muted-foreground">
 Invited as <Badge variant="outline" className="text-[10px]">{i.role}</Badge>
 {' · '}
 {new Date(i.createdAt).toLocaleDateString()}
 </div>
 </div>
 {i.acceptedAt ? (
 <Badge variant="default" className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"><UserCheck className="h-3 w-3 mr-1" /> Accepted {new Date(i.acceptedAt).toLocaleDateString()}</Badge>
 ) : i.expiresAt && new Date(i.expiresAt) < new Date() ? (
 <Badge variant="outline" className="text-red-700 dark:text-red-300 border-red-300">Expired</Badge>
 ) : (
 <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-300">Pending</Badge>
 )}
 <Button size="sm" variant="ghost" onClick={() => copyInviteLink(i.token)}>Copy link</Button>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <CreateInvitesDialog
 open={createOpen}
 onOpenChange={setCreateOpen}
 clubId={clubId}
 onCreated={() => refetch()}
 />
 </div>
 )
}

function CreateInvitesDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [emails, setEmails] = useState('')
 const [role, setRole] = useState('MEMBER')

 async function send() {
 const list = emails.split(/[,\n\s]+/).filter(Boolean)
 if (list.length === 0) { toast.error('Add at least one email'); return }
 try {
 const res = await apiPost('/api/invites', { clubId, emails: list, role })
 toast.success(`${res.count} invite(s) sent`)
 setEmails('')
 onOpenChange(false)
 onCreated()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Send member invites</DialogTitle>
 <DialogDescription>We'll email each person a unique magic-link invite to join this club.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Email addresses (comma or newline separated)</Label>
 <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={4} placeholder="alex@school.edu, sam@school.edu" />
 </div>
 <div>
 <Label>Role</Label>
 <Select value={role} onValueChange={setRole}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="MEMBER">Member</SelectItem>
 <SelectItem value="COMMITTEE_HEAD">Committee head</SelectItem>
 <SelectItem value="SECRETARY">Secretary</SelectItem>
 <SelectItem value="TREASURER">Treasurer</SelectItem>
 <SelectItem value="VICE_PRESIDENT">Vice President</SelectItem>
 <SelectItem value="PRESIDENT">President</SelectItem>
 <SelectItem value="ADVISOR">Faculty Advisor</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={send}><Send className="h-4 w-4 mr-1" /> Send invites</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

// =====================================================
// Member Offboarding tab — combined here for simplicity
// =====================================================
export function OffboardingTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/offboarding?clubId=${clubId}` : '/api/offboarding'
 const { data, loading, refetch } = useFetch<{ offboardings: any[] }>(url)
 const [open, setOpen] = useState(false)

 const offboardings = data?.offboardings || []

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Member Offboarding</h2>
 <p className="text-sm text-muted-foreground">Graduate, transfer, or remove members with grace. Auto-creates alumni profiles + sends farewell emails.</p>
 </div>
 <Button onClick={() => setOpen(true)} disabled={clubId === 'ALL'}><GraduationCap className="h-4 w-4" /> Offboard member</Button>
 </div>

 {loading ? (
 <Skeleton className="h-32 w-full" />
 ) : offboardings.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <PartyPopper className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No members offboarded yet.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {offboardings.map((o) => (
 <Card key={o.id}>
 <CardContent className="p-4 flex items-center gap-3 flex-wrap">
 <Avatar className="h-10 w-10" style={{ backgroundColor: avatarColor(o.user?.name || '?') }}>
 <AvatarFallback className="text-white text-xs">{initials(o.user?.name || '?')}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-[200px]">
 <div className="font-medium">{o.user?.name}</div>
 <div className="text-xs text-muted-foreground">{o.user?.email} · Class of {o.user?.graduationYear || '?'}</div>
 </div>
 <Badge variant="outline" className="text-[10px]">{o.type}</Badge>
 {o.alumniInviteSent && <Badge variant="outline" className="text-foreground text-[10px]"><GraduationCap className="h-3 w-3 mr-1" /> Alumni</Badge>}
 <div className="text-xs text-muted-foreground">{new Date(o.effectiveDate).toLocaleDateString()}</div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <OffboardDialog open={open} onOpenChange={setOpen} clubId={clubId} onDone={() => refetch()} />
 </div>
 )
}

function OffboardDialog({ open, onOpenChange, clubId, onDone }: any) {
 const { data: membersData } = useFetch<{ members: any[] }>(`/api/members?clubId=${clubId}&limit=200`)
 const [userId, setUserId] = useState('')
 const [type, setType] = useState('GRADUATION')
 const [reason, setReason] = useState('')
 const [farewell, setFarewell] = useState('')

 const members = membersData?.members || []

 async function submit() {
 if (!userId) { toast.error('Pick a member'); return }
 try {
 await apiPost('/api/offboarding', { userId, clubId, type, reason, farewellMessage: farewell, inviteToAlumni: true })
 toast.success('Member offboarded — farewell email queued')
 setUserId(''); setReason(''); setFarewell('')
 onOpenChange(false)
 onDone()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Offboard a member</DialogTitle>
 <DialogDescription>This will mark their membership as inactive, optionally transition them to alumni, and send a farewell email.</DialogDescription>
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
 <Label>Reason</Label>
 <Select value={type} onValueChange={setType}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="GRADUATION">Graduation</SelectItem>
 <SelectItem value="TRANSFER">Transfer</SelectItem>
 <SelectItem value="RESIGNATION">Resignation</SelectItem>
 <SelectItem value="REMOVAL">Removal (disciplinary)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Additional notes (optional)</Label>
 <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional context" />
 </div>
 <div>
 <Label>Farewell message (sent via email)</Label>
 <Textarea value={farewell} onChange={(e) => setFarewell(e.target.value)} rows={4} placeholder="Dear ___, thank you for everything you contributed to the club…" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit} variant="default">Offboard member</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
