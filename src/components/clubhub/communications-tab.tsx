'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { useAuth } from '@/lib/clubhub/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Pin, Mail, MessageSquare, Bell, Clock, Megaphone, AlertCircle, Paperclip, Calendar } from 'lucide-react'
import { ANNOUNCEMENT_PRIORITIES, avatarColor, initials, timeAgo, formatDate, type Announcement } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function CommunicationsTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/announcements?clubId=${clubId}` : `/api/announcements`
 const { data, loading, refetch } = useFetch<{ announcements: Announcement[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)

 const announcements = (data?.announcements || []).slice().sort((a, b) => {
 if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
 return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
 })

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Announcements</h2>
 <p className="text-sm text-muted-foreground">Send updates, reminders, and news to your club.</p>
 </div>
 <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Announcement</Button>
 </div>

 {loading ? (
 <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
 ) : announcements.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>No announcements yet. Create one to spread the word!</p>
 </CardContent></Card>
 ) : (
 <div className="space-y-3">
 {announcements.map(a => <AnnouncementCard key={a.id} announcement={a} />)}
 </div>
 )}

 <CreateAnnouncementDialog
 open={createOpen}
 onOpenChange={setCreateOpen}
 clubId={clubId}
 onCreated={() => refetch()}
 />
 </div>
 )
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
 const priority = ANNOUNCEMENT_PRIORITIES.find(p => p.value === announcement.priority) || ANNOUNCEMENT_PRIORITIES[1]
 return (
 <Card className={`${announcement.isPinned ? 'border-primary/40 bg-primary/5' : ''} hover:transition-shadow`}>
 <CardContent className="p-4">
 <div className="flex items-start gap-3">
 {announcement.isPinned && (
 <Pin className="h-4 w-4 text-primary shrink-0 mt-1" />
 )}
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2 flex-wrap">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="font-semibold">{announcement.title}</h3>
 <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: priority.color + '20', color: priority.color }}>
 {announcement.priority}
 </Badge>
 {announcement.category && (
 <Badge variant="secondary" className="text-[10px]">{announcement.category}</Badge>
 )}
 </div>
 <div className="text-xs text-muted-foreground">{timeAgo(announcement.createdAt)}</div>
 </div>

 <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{announcement.content}</p>

 <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
 <div className="flex items-center gap-2">
 <Avatar className="h-6 w-6" style={{ backgroundColor: avatarColor(announcement.author?.name || '?') }}>
 <AvatarFallback className="text-white text-[10px]">{initials(announcement.author?.name || '?')}</AvatarFallback>
 </Avatar>
 <span>{announcement.author?.name}</span>
 </div>
 {announcement.club?.name && (
 <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: `${announcement.club.primaryColor}20` }}>
 {announcement.club.name}
 </Badge>
 )}
 {announcement.sendEmail && (
 <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
 )}
 {announcement.sendSMS && (
 <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> SMS</span>
 )}
 {announcement.scheduledFor && (
 <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Scheduled for {formatDate(announcement.scheduledFor)}</span>
 )}
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 )
}

function CreateAnnouncementDialog({ open, onOpenChange, clubId, onCreated }: {
 open: boolean
 onOpenChange: (o: boolean) => void
 clubId: string
 onCreated: () => void
}) {
 const [form, setForm] = useState({
 title: '', content: '', priority: 'NORMAL', category: 'general',
 isPinned: false, sendEmail: false, sendSMS: false, scheduledFor: ''
 })

 // Use the signed-in user as the author (never impersonate another member).
 const { user } = useAuth()
 const authorId = user?.id

 const handleSubmit = async () => {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 if (!authorId) { toast.error('Sign in to post an announcement'); return }
 if (!form.title || !form.content) { toast.error('Title and content required'); return }
 try {
 await apiPost('/api/announcements', {
 ...form,
 clubId,
 authorId,
 scheduledFor: form.scheduledFor || null,
 })
 toast.success('Announcement posted')
 setForm({ title: '', content: '', priority: 'NORMAL', category: 'general', isPinned: false, sendEmail: false, sendSMS: false, scheduledFor: '' })
 onOpenChange(false)
 onCreated()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>New Announcement</DialogTitle>
 <DialogDescription>Compose an announcement for your club members.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Title</Label>
 <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Meeting moved to Room 302" />
 </div>
 <div>
 <Label>Content</Label>
 <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={5} placeholder="Write your announcement..." />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Priority</Label>
 <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {ANNOUNCEMENT_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Category</Label>
 <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="general">General</SelectItem>
 <SelectItem value="meeting">Meeting</SelectItem>
 <SelectItem value="event">Event</SelectItem>
 <SelectItem value="dues">Dues</SelectItem>
 <SelectItem value="service">Service</SelectItem>
 <SelectItem value="competition">Competition</SelectItem>
 <SelectItem value="social">Social</SelectItem>
 <SelectItem value="urgent">Urgent</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 <div>
 <Label>Schedule For (optional)</Label>
 <Input type="datetime-local" value={form.scheduledFor} onChange={e => setForm({ ...form, scheduledFor: e.target.value })} />
 </div>
 <div className="grid grid-cols-3 gap-3 pt-2">
 <div className="flex items-center gap-2">
 <Switch checked={form.isPinned} onCheckedChange={v => setForm({ ...form, isPinned: v })} id="pin" />
 <Label htmlFor="pin" className="text-sm cursor-pointer">Pin</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch checked={form.sendEmail} onCheckedChange={v => setForm({ ...form, sendEmail: v })} id="email" />
 <Label htmlFor="email" className="text-sm cursor-pointer">Email</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch checked={form.sendSMS} onCheckedChange={v => setForm({ ...form, sendSMS: v })} id="sms" />
 <Label htmlFor="sms" className="text-sm cursor-pointer">SMS</Label>
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={handleSubmit} disabled={!form.title || !form.content || clubId === 'ALL' || !authorId}>
 <Megaphone className="h-4 w-4 mr-1" /> Post Announcement
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
