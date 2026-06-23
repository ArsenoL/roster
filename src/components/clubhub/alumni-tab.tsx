'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { GraduationCap, Plus, Briefcase, Mic, Heart, Mail, MapPin, Linkedin, Users, Award } from 'lucide-react'
import { avatarColor, initials } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function AlumniTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/alumni?clubId=${clubId}` : '/api/alumni'
 const { data, loading, refetch } = useFetch<any>(url)
 const [addOpen, setAddOpen] = useState(false)

 const alumni = data?.alumni || []
 const summary = data?.summary || { total: 0, mentors: 0, donors: 0, speakers: 0, byYear: {}, byCollege: {} }

 return (
 <div className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center mb-2"><GraduationCap className="h-4 w-4 text-blue-700 dark:text-blue-300" /></div><div className="text-xs text-muted-foreground">Total Alumni</div><div className="text-xl font-bold">{summary.total}</div></CardContent></Card>
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-2"><Heart className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /></div><div className="text-xs text-muted-foreground">Mentors</div><div className="text-xl font-bold">{summary.mentors}</div></CardContent></Card>
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-2"><Mic className="h-4 w-4 text-amber-700 dark:text-amber-300" /></div><div className="text-xs text-muted-foreground">Speakers</div><div className="text-xl font-bold">{summary.speakers}</div></CardContent></Card>
 <Card><CardContent className="p-4"><div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center mb-2"><Award className="h-4 w-4 text-purple-700 dark:text-purple-300" /></div><div className="text-xs text-muted-foreground">Donors</div><div className="text-xl font-bold">{summary.donors}</div></CardContent></Card>
 </div>

 <Tabs defaultValue="directory">
 <div className="flex items-center justify-between">
 <TabsList>
 <TabsTrigger value="directory">Directory ({alumni.length})</TabsTrigger>
 <TabsTrigger value="colleges">By College</TabsTrigger>
 <TabsTrigger value="years">By Year</TabsTrigger>
 </TabsList>
 <Button onClick={() => setAddOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Add Alumni</Button>
 </div>

 <TabsContent value="directory" className="mt-4">
 {loading ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
 ) : alumni.length === 0 ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
 <GraduationCap className="h-10 w-10 mx-auto mb-2 opacity-30" />
 No alumni records yet. Track graduates for mentorship, networking, and donor cultivation.
 </CardContent></Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {alumni.map(a => (
 <Card key={a.id}>
 <CardContent className="p-4 flex items-start gap-3">
 <Avatar className="h-12 w-12" style={{ backgroundColor: avatarColor(a.user?.name || 'A') }}>
 <AvatarFallback className="text-white text-xs">{initials(a.user?.name || 'A')}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <div className="font-medium text-sm">{a.user?.name}</div>
 <Badge variant="outline">Class of {a.graduationYear}</Badge>
 </div>
 <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
 {a.college && <div className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{a.college}{a.major ? ` · ${a.major}` : ''}</div>}
 {a.career && <div className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{a.career}{a.employer ? ` @ ${a.employer}` : ''}</div>}
 {a.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</div>}
 {a.linkedin && ((): any => {
 // Validate the URL is http(s) — `javascript:` LinkedIn URLs are an XSS vector.
 if (!/^https?:\/\//i.test(a.linkedin)) {
 return <span className="flex items-center gap-1 text-muted-foreground"><Linkedin className="h-3 w-3" />LinkedIn</span>
 }
 return <a href={a.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-foreground hover:underline"><Linkedin className="h-3 w-3" />LinkedIn</a>
 })()}
 </div>
 <div className="flex flex-wrap gap-1 mt-2">
 {a.mentorshipAvailable && <Badge variant="outline" className="text-foreground text-[10px]"><Heart className="h-2.5 w-2.5 mr-1" />Mentor</Badge>}
 {a.willingToSpeak && <Badge variant="outline" className="text-foreground text-[10px]"><Mic className="h-2.5 w-2.5 mr-1" />Speaker</Badge>}
 {a.willingToDonate && <Badge variant="outline" className="text-foreground text-[10px]"><Award className="h-2.5 w-2.5 mr-1" />Donor</Badge>}
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </TabsContent>

 <TabsContent value="colleges" className="mt-4">
 <Card>
 <CardHeader><CardTitle className="text-base">Alumni by College</CardTitle></CardHeader>
 <CardContent>
 {Object.keys(summary.byCollege).length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No college data</div>
 ) : (
 <div className="space-y-2">
 {Object.entries(summary.byCollege).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([college, count]) => (
 <div key={college} className="flex items-center justify-between p-2 rounded border">
 <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-foreground" /><span className="font-medium">{college}</span></div>
 <Badge>{count as number}</Badge>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="years" className="mt-4">
 <Card>
 <CardHeader><CardTitle className="text-base">Alumni by Graduation Year</CardTitle></CardHeader>
 <CardContent>
 {Object.keys(summary.byYear).length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No year data</div>
 ) : (
 <div className="space-y-2">
 {Object.entries(summary.byYear).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).map(([year, count]) => (
 <div key={year} className="flex items-center justify-between p-2 rounded border">
 <span className="font-medium">Class of {year}</span>
 <Badge>{count as number}</Badge>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 <AddAlumniDialog open={addOpen} onOpenChange={setAddOpen} clubId={clubId} onCreated={() => { refetch(); setAddOpen(false) }} />
 </div>
 )
}

function AddAlumniDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [form, setForm] = useState({
 userId: '',
 graduationYear: new Date().getFullYear() - 1,
 college: '',
 major: '',
 career: '',
 employer: '',
 location: '',
 linkedin: '',
 mentorshipAvailable: false,
 willingToDonate: false,
 willingToSpeak: false,
 newsletter: true,
 })
 const { data: membersData } = useFetch<{ members: any[] }>(clubId !== 'ALL' ? `/api/members?clubId=${clubId}` : '/api/members')

 const submit = async () => {
 try {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 if (!form.userId) { toast.error('Select a user'); return }
 await apiPost('/api/alumni', { ...form, clubId })
 toast.success('Alumni added')
 onCreated()
 } catch (e: any) { if (!e?.silent) toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Add Alumni</DialogTitle></DialogHeader>
 <div className="space-y-3">
 <div>
 <Label>Member</Label>
 <Select value={form.userId} onValueChange={v => setForm({ ...form, userId: v })}>
 <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
 <SelectContent>{(membersData?.members || []).map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.user.name}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Graduation Year</Label><Input type="number" value={form.graduationYear} onChange={e => setForm({ ...form, graduationYear: parseInt(e.target.value) })} /></div>
 <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Boston, MA" /></div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>College</Label><Input value={form.college} onChange={e => setForm({ ...form, college: e.target.value })} placeholder="e.g. MIT" /></div>
 <div><Label>Major</Label><Input value={form.major} onChange={e => setForm({ ...form, major: e.target.value })} placeholder="e.g. Computer Science" /></div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Career</Label><Input value={form.career} onChange={e => setForm({ ...form, career: e.target.value })} placeholder="e.g. Software Engineer" /></div>
 <div><Label>Employer</Label><Input value={form.employer} onChange={e => setForm({ ...form, employer: e.target.value })} placeholder="e.g. Google" /></div>
 </div>
 <div><Label>LinkedIn URL</Label><Input value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." /></div>
 <div className="flex flex-wrap gap-3 text-sm">
 <label className="flex items-center gap-1"><input type="checkbox" checked={form.mentorshipAvailable} onChange={e => setForm({ ...form, mentorshipAvailable: e.target.checked })} /> Mentor</label>
 <label className="flex items-center gap-1"><input type="checkbox" checked={form.willingToSpeak} onChange={e => setForm({ ...form, willingToSpeak: e.target.checked })} /> Speaker</label>
 <label className="flex items-center gap-1"><input type="checkbox" checked={form.willingToDonate} onChange={e => setForm({ ...form, willingToDonate: e.target.checked })} /> Donor</label>
 <label className="flex items-center gap-1"><input type="checkbox" checked={form.newsletter} onChange={e => setForm({ ...form, newsletter: e.target.checked })} /> Newsletter</label>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Add Alumni</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
