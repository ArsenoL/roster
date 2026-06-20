'use client'

import { useState, use } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarDays, MapPin, Clock, Users, DollarSign, GraduationCap, Heart, ArrowRight, CheckCircle2 } from 'lucide-react'
import { formatDate, formatTime, eventTypeEmoji, categoryEmoji } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export default function PublicPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { data, loading } = useFetch<any>(`/api/public/${slug}`)
  const [applyOpen, setApplyOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading club...</div>
      </div>
    )
  }

  if (!data || data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <h1 className="text-xl font-bold mb-2">Club Not Found</h1>
            <p className="text-sm text-muted-foreground">This club doesn't exist or isn't publicly visible.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { club, upcomingEvents, recentNews, applicationsEnabled } = data

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — civic */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/discover" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back to discover
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            Roster
          </Link>
        </div>
      </header>

      {/* Hero — civic: solid background, ruled border-b, no gradient overlay */}
      <div className="border-b border-border bg-muted">
        <div className="container mx-auto max-w-5xl py-10 md:py-14">
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline">
              {categoryEmoji(club.category)} {club.category}
            </Badge>
            {club.foundedYear && <Badge variant="outline">Est. {club.foundedYear}</Badge>}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">{club.name}</h1>
          <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
            {club.presidentName && <span className="flex items-center gap-1"><GraduationCap className="h-4 w-4" /> President: {club.presidentName}</span>}
            {club.advisorName && <span>· Advisor: {club.advisorName}</span>}
            <span>· {club.memberCount} members</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl relative space-y-8 py-10 md:py-14">
        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <Users className="h-5 w-5 text-blue-500 mb-1" />
            <div className="text-2xl font-bold">{club.memberCount}</div>
            <div className="text-xs text-muted-foreground">Members</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <CalendarDays className="h-5 w-5 text-emerald-500 mb-1" />
            <div className="text-2xl font-bold">{club.eventCount}</div>
            <div className="text-xs text-muted-foreground">Events Held</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <Clock className="h-5 w-5 text-amber-500 mb-1" />
            <div className="text-xl font-bold">{club.defaultDay || 'TBD'}</div>
            <div className="text-xs text-muted-foreground">{club.defaultTime || 'Time TBD'}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <MapPin className="h-5 w-5 text-purple-500 mb-1" />
            <div className="text-xl font-bold">{club.meetingRoom || 'TBD'}</div>
            <div className="text-xs text-muted-foreground">Meeting Location</div>
          </CardContent></Card>
        </div>

        {/* About */}
        {club.description && (
          <Card>
            <CardHeader><CardTitle>About Us</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{club.description}</p>
              {club.mission && (
                <div className="mt-4 p-3 border-l-2 border-foreground bg-muted">
                  <div className="label-mono mb-1">Our Mission</div>
                  <div className="text-sm">{club.mission}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dues & apply CTA */}
        <Card className="border-border">
          <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-lg font-semibold mb-1">Join {club.name}</div>
              {club.dues > 0 && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> ${club.dues} {club.duesCurrency} dues{club.requireApproval ? ' · Approval required to join' : ''}
                </div>
              )}
              {!club.dues && <div className="text-sm text-muted-foreground">Free to join · {club.requireApproval ? 'Approval required' : 'Open enrollment'}</div>}
            </div>
            {applicationsEnabled ? (
              <Button size="lg" onClick={() => setApplyOpen(true)}>
                Apply to Join <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={() => toast.info('Contact the club president to join!')}>
                Contact to Join
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-3">Upcoming Events</h2>
            <div className="space-y-2">
              {upcomingEvents.map((e: any) => (
                <Card key={e.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted flex items-center justify-center text-xl">
                      {eventTypeEmoji(e.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                        <span>{formatDate(e.startTime)}</span>
                        <span>·</span>
                        <span>{formatTime(e.startTime)}</span>
                        {e.location && <><span>·</span><span>{e.location}</span></>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent news */}
        {recentNews.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-3">Latest News</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recentNews.map((n: any) => (
                <Card key={n.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{n.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-3">{n.content}</p>
                    <div className="text-[10px] text-muted-foreground mt-2">{formatDate(n.createdAt)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-4">
          Powered by <span className="font-semibold">Roster</span> · The complete high school club operating system
        </div>
      </div>

      {applyOpen && <ApplyDialog clubId={club.id} onClose={() => setApplyOpen(false)} />}
    </div>
  )
}

function ApplyDialog({ clubId, onClose }: any) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    grade: '',
    studentId: '',
    phone: '',
    whyJoin: '',
    experience: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const submit = async () => {
    try {
      if (!form.name || !form.email) { toast.error('Name and email are required'); return }
      await apiPost('/api/applications', {
        clubId,
        name: form.name,
        email: form.email,
        grade: form.grade ? parseInt(form.grade) : null,
        studentId: form.studentId || null,
        phone: form.phone || null,
        responses: {
          'Why do you want to join?': form.whyJoin,
          'Relevant experience': form.experience,
        },
      })
      setSubmitted(true)
    } catch (e: any) { toast.error(e.message) }
  }

  if (submitted) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <DialogTitle>Application Submitted!</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">Thank you for applying. The club leadership will review your application and reach out via email.</p>
            <Button className="mt-4" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Apply to Join</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Grade</Label><Input type="number" min={9} max={12} value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} /></div>
            <div><Label>Student ID</Label><Input value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Why do you want to join?</Label><Textarea rows={3} value={form.whyJoin} onChange={e => setForm({ ...form, whyJoin: e.target.value })} /></div>
          <div><Label>Relevant experience (optional)</Label><Textarea rows={2} value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Submit Application</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
