'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiPatch, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { FileText, Plus, FolderOpen, File, Download, Eye, MessageSquare, Check, X } from 'lucide-react'
import { formatDateTime, timeAgo, formatDate, avatarColor, initials } from '@/lib/clubhub/types'
import { toast } from 'sonner'

const CATEGORIES = [
 { value: 'bylaws', label: 'Bylaws & Charter', emoji: '📜' },
 { value: 'minutes', label: 'Meeting Minutes', emoji: '📝' },
 { value: 'sheet-music', label: 'Sheet Music', emoji: '🎼' },
 { value: 'code', label: 'Code & Projects', emoji: '💻' },
 { value: 'forms', label: 'Forms & Templates', emoji: '📋' },
 { value: 'handbook', label: 'Handbook', emoji: '📖' },
 { value: 'marketing', label: 'Marketing Assets', emoji: '🎨' },
 { value: 'other', label: 'Other', emoji: '📁' },
]

export function DocumentsTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/documents?clubId=${clubId}` : '/api/documents'
 const { data, loading, refetch } = useFetch<{ documents: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [openDoc, setOpenDoc] = useState<any | null>(null)

 const docs = data?.documents || []

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">{docs.length} document(s) across {CATEGORIES.length} categories</p>
 <Button onClick={() => setCreateOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Document</Button>
 </div>

 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
 ) : docs.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
 <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
 No documents yet. Upload bylaws, meeting minutes, sheet music, code, and more.
 </CardContent></Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
 {docs.map(d => {
 const cat = CATEGORIES.find(c => c.value === d.category) || CATEGORIES[CATEGORIES.length - 1]
 return (
 <Card key={d.id} className="hover: transition-shadow cursor-pointer" onClick={() => setOpenDoc(d)}>
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between">
 <div className="text-3xl">{cat.emoji}</div>
 <div className="flex items-center gap-1">
 {d.isPublic && <Badge variant="outline" className="text-[10px]">Public</Badge>}
 <Badge variant="outline" className="text-[10px]">v{d.version}</Badge>
 </div>
 </div>
 <CardTitle className="text-base mt-1">{d.title}</CardTitle>
 <CardDescription className="line-clamp-2">{d.description || 'No description'}</CardDescription>
 </CardHeader>
 <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
 <div className="flex items-center gap-1"><File className="h-3 w-3" />{cat.label}</div>
 <div>Uploaded {timeAgo(d.createdAt)} by {d.uploadedBy?.name || 'Unknown'}</div>
 <div className="flex items-center gap-2">
 <span>{d.viewCount} views</span>
 <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{(d as any)._count?.comments || 0}</span>
 </div>
 {d.fileUrl && (
 <Button size="sm" variant="outline" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); window.open(d.fileUrl, '_blank') }}>
 <Download className="h-3 w-3 mr-1" /> Download
 </Button>
 )}
 </CardContent>
 </Card>
 )
 })}
 </div>
 )}

 <CreateDocumentDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => { refetch(); setCreateOpen(false) }} />
 <DocumentDetailDialog doc={openDoc} onClose={() => setOpenDoc(null)} />
 </div>
 )
}

function DocumentDetailDialog({ doc, onClose }: { doc: any; onClose: () => void }) {
 const { data, refetch } = useFetch<{ comments: any[] }>(
 doc ? `/api/document-comments?documentId=${doc.id}` : null
 )
 const [newComment, setNewComment] = useState('')
 const comments = data?.comments || []

 async function addComment() {
 if (!newComment.trim() || !doc) return
 try {
 // For demo, use first club member as commenter
 const res = await fetch(`/api/members?clubId=${doc.clubId}&limit=1`)
 const d = await res.json()
 const userId = d.members?.[0]?.userId
 if (!userId) { toast.error('No members found'); return }
 await apiPost('/api/document-comments', {
 documentId: doc.id,
 userId,
 body: newComment,
 })
 setNewComment('')
 refetch()
 toast.success('Comment added')
 } catch (e: any) { toast.error(e.message) }
 }

 async function toggleResolve(comment: any) {
 try {
 await apiPatch(`/api/document-comments/${comment.id}`, { resolved: !comment.resolved })
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 async function deleteComment(id: string) {
 try {
 await apiDelete(`/api/document-comments/${id}`)
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 if (!doc) return null

 return (
 <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
 <DialogContent className="max-w-2xl max-h-[80vh]">
 <DialogHeader>
 <DialogTitle>{doc.title}</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}
 {doc.fileUrl && (
 <Button size="sm" variant="outline" onClick={() => window.open(doc.fileUrl, '_blank')}>
 <Download className="h-3 w-3 mr-1" /> Download file
 </Button>
 )}

 <div className="border-t pt-3">
 <div className="text-sm font-medium flex items-center gap-1 mb-2">
 <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
 </div>
 <ScrollArea className="max-h-[40vh]">
 <div className="space-y-2 pr-2">
 {comments.length === 0 && (
 <div className="text-xs text-muted-foreground py-4 text-center">No comments yet.</div>
 )}
 {comments.map((c) => (
 <div key={c.id} className={`p-2 rounded-lg ${c.resolved ? 'bg-foreground dark:bg-emerald-950/20' : 'bg-muted/50'}`}>
 <div className="flex items-start gap-2">
 <Avatar className="h-6 w-6 shrink-0" style={{ backgroundColor: avatarColor(c.user?.name || '?') }}>
 <AvatarFallback className="text-white text-[10px]">{initials(c.user?.name || '?')}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <div className="text-xs font-medium">{c.user?.name}</div>
 <div className="flex items-center gap-1">
 {c.resolved && <Badge className="text-[9px] bg-foreground">RESOLVED</Badge>}
 <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleResolve(c)}>
 {c.resolved ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
 </Button>
 <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground" onClick={() => deleteComment(c.id)}>
 <X className="h-3 w-3" />
 </Button>
 </div>
 </div>
 <div className="text-sm whitespace-pre-wrap">{c.body}</div>
 <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(c.createdAt)}</div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 <div className="flex gap-2 mt-2">
 <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add a comment…" onKeyDown={(e) => e.key === 'Enter' && addComment()} />
 <Button onClick={addComment} disabled={!newComment.trim()}>Post</Button>
 </div>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 )
}

function CreateDocumentDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 title: '',
 description: '',
 category: 'other',
 fileUrl: '',
 isPublic: false,
 })

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 if (!form.title) { toast.error('Title required'); return }
 await apiPost('/api/documents', { ...form, clubId })
 toast.success('Document added')
 onCreated()
 setForm({ ...form, title: '', description: '', fileUrl: '' })
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> New Document</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Photography Club Bylaws" /></div>
 <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Category</Label>
 <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div><Label>File URL (optional)</Label><Input value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://..." /></div>
 </div>
 <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })} /> Visible on public portal</label>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Add Document</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
