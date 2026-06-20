'use client'

import { useState } from 'react'
import { useFetch, apiPatch } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserPlus, Mail, CheckCircle, XCircle, Clock, Users, ExternalLink, Globe } from 'lucide-react'
import { applicationStatusLabel, applicationStatusColor, formatDate, timeAgo } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function ApplicationsTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/applications?clubId=${clubId}` : '/api/applications'
 const { data, loading, refetch } = useFetch<any>(url)
 const [reviewId, setReviewId] = useState<string | null>(null)

 const apps = data?.applications || []
 const summary = data?.summary || { total: 0, pending: 0, accepted: 0, rejected: 0, waitlisted: 0 }

 return (
 <div className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{summary.total}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Pending</div><div className="text-2xl font-bold text-foreground">{summary.pending}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Accepted</div><div className="text-2xl font-bold text-foreground">{summary.accepted}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Waitlisted</div><div className="text-2xl font-bold text-foreground">{summary.waitlisted}</div></CardContent></Card>
 <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Rejected</div><div className="text-2xl font-bold text-foreground">{summary.rejected}</div></CardContent></Card>
 </div>

 {clubId !== 'ALL' && (
 <Card className="bg-muted border-foreground/20">
 <CardContent className="p-4 flex items-center gap-3">
 <Globe className="h-8 w-8 text-foreground" />
 <div className="flex-1">
 <div className="font-medium text-sm">Public Recruitment Portal</div>
 <div className="text-xs text-muted-foreground">Students can apply to your club via the public URL</div>
 </div>
 <Button size="sm" variant="outline" onClick={() => window.open(`/portal/${clubId}`, '_blank')}>
 <ExternalLink className="h-3 w-3 mr-1" /> View Portal
 </Button>
 </CardContent>
 </Card>
 )}

 <Tabs defaultValue="pending">
 <TabsList>
 <TabsTrigger value="pending">Pending ({summary.pending})</TabsTrigger>
 <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
 <TabsTrigger value="all">All</TabsTrigger>
 </TabsList>

 <TabsContent value="pending" className="mt-4 space-y-2">
 {loading ? (
 <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
 ) : apps.filter(a => a.status === 'PENDING').length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
 <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
 No pending applications
 </CardContent></Card>
 ) : apps.filter(a => a.status === 'PENDING').map(a => <AppRow key={a.id} app={a} onReview={() => setReviewId(a.id)} />)}
 </TabsContent>

 <TabsContent value="reviewed" className="mt-4 space-y-2">
 {apps.filter(a => a.status !== 'PENDING').map(a => <AppRow key={a.id} app={a} onReview={() => setReviewId(a.id)} />)}
 </TabsContent>

 <TabsContent value="all" className="mt-4 space-y-2">
 {apps.map(a => <AppRow key={a.id} app={a} onReview={() => setReviewId(a.id)} />)}
 </TabsContent>
 </Tabs>

 {reviewId && <ReviewDialog appId={reviewId} clubId={clubId} onClose={() => { setReviewId(null); refetch() }} />}
 </div>
 )
}

function AppRow({ app, onReview }: any) {
 const responses = (() => { try { return JSON.parse(app.responses) } catch { return {} } })()
 return (
 <Card>
 <CardContent className="p-3 flex items-center gap-3">
 <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-white text-xs font-bold shrink-0">
 {app.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm">{app.name}</div>
 <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
 <span>{app.email}</span>
 {app.grade && <><span>·</span><span>Grade {app.grade}</span></>}
 <span>·</span><span>Applied {timeAgo(app.createdAt)}</span>
 </div>
 </div>
 <Badge style={{ backgroundColor: applicationStatusColor(app.status) + '20', color: applicationStatusColor(app.status) }}>{applicationStatusLabel(app.status)}</Badge>
 <Button size="sm" variant="outline" onClick={onReview}>Review</Button>
 </CardContent>
 </Card>
 )
}

function ReviewDialog({ appId, clubId, onClose }: any) {
 const { data, loading } = useFetch<any>(`/api/applications?clubId=${clubId}`)
 const app = data?.applications?.find((a: any) => a.id === appId)
 const [notes, setNotes] = useState('')
 const [rejectReason, setRejectReason] = useState('')

 if (loading || !app) return <Dialog open onOpenChange={onClose}><DialogContent><Skeleton className="h-64 w-full" /></DialogContent></Dialog>

 const responses = (() => { try { return JSON.parse(app.responses) } catch { return {} } })()

 const update = async (status: string) => {
 try {
 await apiPatch(`/api/applications/${appId}`, {
 status,
 reviewNotes: notes,
 rejectionReason: status === 'REJECTED' ? rejectReason : null,
 })
 toast.success(`Application ${status.toLowerCase()}`)
 onClose()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open onOpenChange={onClose}>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Application — {app.name}</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div><span className="text-muted-foreground">Email:</span> {app.email}</div>
 {app.grade && <div><span className="text-muted-foreground">Grade:</span> {app.grade}</div>}
 {app.studentId && <div><span className="text-muted-foreground">Student ID:</span> {app.studentId}</div>}
 {app.phone && <div><span className="text-muted-foreground">Phone:</span> {app.phone}</div>}
 <div><span className="text-muted-foreground">Applied:</span> {formatDate(app.createdAt)}</div>
 </div>
 {Object.keys(responses).length > 0 && (
 <div>
 <Label>Application Responses</Label>
 <div className="space-y-1 mt-1">
 {Object.entries(responses).map(([k, v]) => (
 <div key={k} className="text-sm bg-muted/30 rounded p-2"><span className="text-muted-foreground">{k}:</span> {String(v)}</div>
 ))}
 </div>
 </div>
 )}
 <div><Label>Review Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes about this applicant" /></div>
 {app.status === 'REJECTED' || notes.length === 0 ? null : null}
 <div className="flex flex-wrap gap-2 pt-2">
 <Button onClick={() => update('ACCEPTED')} className="bg-foreground hover:bg-foreground"><CheckCircle className="h-4 w-4 mr-1" /> Accept & Add to Club</Button>
 <Button onClick={() => update('WAITLISTED')} variant="outline"><Clock className="h-4 w-4 mr-1" /> Waitlist</Button>
 <Button onClick={() => update('INVITED')} variant="outline"><Mail className="h-4 w-4 mr-1" /> Invite to Interview</Button>
 <Button onClick={() => update('REJECTED')} variant="outline" className="text-foreground"><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 )
}
