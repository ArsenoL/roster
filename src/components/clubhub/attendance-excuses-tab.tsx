'use client'

import { useState } from 'react'
import { useFetch, apiPatch, apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, FileText, Clock, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export function AttendanceExcusesTab({ clubId }: { clubId: string }) {
 const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'DENIED' | 'ALL'>('PENDING')
 const url = `/api/attendance-excuses?clubId=${clubId}${filter !== 'ALL' ? `&status=${filter}` : ''}`
 const { data, loading, refetch } = useFetch<{ excuses: any[] }>(url)
 const [reviewing, setReviewing] = useState<any | null>(null)

 const excuses = data?.excuses || []

 async function review(id: string, status: 'APPROVED' | 'DENIED', notes?: string) {
 try {
 // Use the first membership of the club as the reviewer (demo). In real auth, this would be current user.
 const reviewerId = 'demo-user-1'
 await apiPatch(`/api/attendance-excuses/${id}`, { status, approvedById: reviewerId, reviewerNotes: notes })
 toast.success(`Excuse ${status.toLowerCase()}`)
 setReviewing(null)
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between flex-wrap gap-2">
 <div>
 <h2 className="text-lg font-semibold">Absence Excuses</h2>
 <p className="text-sm text-muted-foreground">Review and approve/deny excuses submitted by students or parents.</p>
 </div>
 <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
 <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="PENDING">Pending</SelectItem>
 <SelectItem value="APPROVED">Approved</SelectItem>
 <SelectItem value="DENIED">Denied</SelectItem>
 <SelectItem value="ALL">All</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
 ) : excuses.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No {filter.toLowerCase()} excuses.
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {excuses.map((e) => (
 <Card key={e.id}>
 <CardContent className="p-4 space-y-2">
 <div className="flex items-start justify-between gap-2 flex-wrap">
 <div>
 <div className="font-medium">{e.user?.name}</div>
 <div className="text-xs text-muted-foreground">{e.user?.email} · Grade {e.user?.grade || '—'}</div>
 </div>
 <StatusBadge status={e.status} />
 </div>
 <div className="text-sm">
 <div className="font-medium">{e.event?.title}</div>
 <div className="text-xs text-muted-foreground flex items-center gap-1">
 <Calendar className="h-3 w-3" /> {new Date(e.event?.startTime).toLocaleString()}
 </div>
 </div>
 <div className="text-sm">
 <span className="text-xs text-muted-foreground">Reason:</span> <span className="font-medium">{e.reason}</span>
 </div>
 {e.description && <div className="text-sm text-muted-foreground italic">"{e.description}"</div>}
 <div className="text-xs text-muted-foreground flex items-center gap-1">
 <Clock className="h-3 w-3" /> Submitted {new Date(e.createdAt).toLocaleString()}
 </div>
 {e.status === 'PENDING' && (
 <div className="flex gap-2 pt-2">
 <Button size="sm" onClick={() => setReviewing(e)}>
 <Check className="h-3.5 w-3.5 mr-1" /> Review
 </Button>
 </div>
 )}
 {e.reviewedAt && (
 <div className="text-xs text-muted-foreground">Reviewed {new Date(e.reviewedAt).toLocaleString()}</div>
 )}
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <ReviewDialog
 excuse={reviewing}
 onOpenChange={(o) => !o && setReviewing(null)}
 onApprove={(notes) => review(reviewing.id, 'APPROVED', notes)}
 onDeny={(notes) => review(reviewing.id, 'DENIED', notes)}
 />
 </div>
 )
}

function StatusBadge({ status }: { status: string }) {
 if (status === 'PENDING') return <Badge variant="outline" className="text-foreground border-amber-300">PENDING</Badge>
 if (status === 'APPROVED') return <Badge className="bg-foreground">APPROVED</Badge>
 if (status === 'DENIED') return <Badge variant="destructive">DENIED</Badge>
 return <Badge variant="outline">{status}</Badge>
}

function ReviewDialog({ excuse, onOpenChange, onApprove, onDeny }: any) {
 const [notes, setNotes] = useState('')
 if (!excuse) return null
 return (
 <Dialog open={!!excuse} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Review excuse</DialogTitle>
 <DialogDescription>
 {excuse.user?.name} · {excuse.event?.title}
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
 <div><strong>Reason:</strong> {excuse.reason}</div>
 {excuse.description && <div><strong>Details:</strong> {excuse.description}</div>}
 </div>
 <div>
 <Label>Reviewer notes (optional)</Label>
 <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. Approved — confirmed with parent by phone." />
 </div>
 </div>
 <DialogFooter className="gap-2">
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button variant="destructive" onClick={() => onDeny(notes)}><X className="h-4 w-4 mr-1" /> Deny</Button>
 <Button className="bg-foreground hover:bg-foreground" onClick={() => onApprove(notes)}>
 <Check className="h-4 w-4 mr-1" /> Approve
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
