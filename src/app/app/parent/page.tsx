'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { useAuth } from '@/lib/clubhub/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Loader2, Moon, Sun, Home, Heart, CalendarCheck, Users, TrendingUp,
  Calendar, Clock, MapPin, ChevronRight, AlertCircle, GraduationCap,
  CheckCircle2, XCircle, FileText, Mail,
} from 'lucide-react'
import {
  formatDate, formatTime, initials, avatarColor, categoryEmoji, statusColor, statusLabel,
} from '@/lib/clubhub/types'

export default function ParentDashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { data, loading, refetch } = useFetch<any>('/api/me/parent')
  const [dark, setDark] = useState(false)
  const [excuseDialog, setExcuseDialog] = useState<{ open: boolean, childId: string | null, childName: string | null }>({
    open: false, childId: null, childName: null,
  })

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/app/parent')
  }, [authLoading, user, router])

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('roster.theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('roster.theme', 'light')
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }
  if (!user) return null

  const children = data?.children || []

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — civic */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              parent
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Avatar className="h-8 w-8" style={{ backgroundColor: avatarColor(user.name) }}>
              <AvatarFallback className="text-white text-xs font-medium">{initials(user.name)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-8 space-y-6">
        {/* Greeting */}
        <div>
          <div className="text-sm text-muted-foreground">Hello,</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{user.name.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's the latest on {children.length === 1 ? 'your child' : `${children.length} children`} across all clubs.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : children.length === 0 ? (
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
              <div className="font-semibold mb-1">No linked students yet</div>
              <div className="text-sm text-muted-foreground max-w-md mx-auto">
                Ask your school administrator or club advisor to link your parent account to your child.
                Once linked, you'll see their attendance, upcoming events, and can submit absence excuses here.
              </div>
              <Button variant="outline" asChild className="mt-4">
                <Link href="/"><Home className="h-3.5 w-3.5 mr-1" /> Back to home</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {children.map((child: any) => (
              <ChildCard
                key={child.student.id}
                child={child}
                onExcuseClick={() => setExcuseDialog({
                  open: true,
                  childId: child.student.id,
                  childName: child.student.name,
                })}
              />
            ))}
          </div>
        )}

        {/* Help / privacy note */}
        <Card className="border-border">
          <CardContent className="p-4 text-sm">
            <div className="flex items-start gap-3">
              <Heart className="h-5 w-5 text-brand shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Parent access is read-only by default.</div>
                <div className="text-muted-foreground mt-0.5">
                  You can view your child's attendance and submit absence excuses. For anything else,
                  contact your school's activities director or club advisor.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {excuseDialog.open && excuseDialog.childId && (
        <ExcuseDialog
          childId={excuseDialog.childId}
          childName={excuseDialog.childName || ''}
          parentUserId={user.id}
          onClose={() => setExcuseDialog({ open: false, childId: null, childName: null })}
          onSubmitted={() => {
            setExcuseDialog({ open: false, childId: null, childName: null })
            refetch()
          }}
        />
      )}
    </div>
  )
}

function ChildCard({ child, onExcuseClick }: { child: any, onExcuseClick: () => void }) {
  const { student, clubs, attendanceStats, upcomingEvents, recentExcuses, recentAttendance } = child
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12" style={{ backgroundColor: avatarColor(student.name) }}>
            <AvatarFallback className="text-white font-semibold">{initials(student.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{student.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
              {student.grade && <Badge variant="outline" className="text-[10px]">Grade {student.grade}</Badge>}
              <span>{clubs.length} club{clubs.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span className="truncate">{student.email}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/40">
            <div className="text-xl font-bold" style={{ color: attendanceStats.rate >= 75 ? '#10b981' : attendanceStats.rate >= 50 ? '#f59e0b' : '#ef4444' }}>
              {attendanceStats.rate}%
            </div>
            <div className="text-[10px] text-muted-foreground">Attendance</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/40">
            <div className="text-xl font-bold text-brand">{attendanceStats.attended}</div>
            <div className="text-[10px] text-muted-foreground">Attended</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/40">
            <div className="text-xl font-bold text-muted-foreground">{attendanceStats.total}</div>
            <div className="text-[10px] text-muted-foreground">Total Events</div>
          </div>
        </div>

        {/* Clubs */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">CLUBS</div>
          <div className="space-y-1.5">
            {clubs.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No active memberships</div>
            ) : (
              clubs.map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: `${m.club.primaryColor}20` }}
                  >
                    {categoryEmoji(m.club.category)}
                  </div>
                  <span className="font-medium truncate flex-1">{m.club.name}</span>
                  {m.club.defaultDay && (
                    <span className="text-[10px] text-muted-foreground">{m.club.defaultDay} {m.club.defaultTime || ''}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming events */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">UPCOMING EVENTS</div>
          {upcomingEvents.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No upcoming events</div>
          ) : (
            <div className="space-y-1.5">
              {upcomingEvents.slice(0, 3).map((e: any) => (
                <div key={e.id} className="flex items-center gap-2 text-sm p-1.5 rounded-md hover:bg-accent/30">
                  <div
                    className="flex flex-col items-center justify-center min-w-[2.5rem] h-10 rounded-md text-white font-semibold text-xs shrink-0"
                    style={{ backgroundColor: e.club.primaryColor || '#6366f1' }}
                  >
                    <span className="text-[9px] uppercase leading-none">{new Date(e.startTime).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-sm leading-none mt-0.5">{new Date(e.startTime).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{e.title}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <Clock className="h-2.5 w-2.5" />{formatTime(e.startTime)}
                      <span>·</span>
                      <span className="truncate">{e.club.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent excuses */}
        {recentExcuses.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">RECENT EXCUSES</div>
            <div className="space-y-1.5">
              {recentExcuses.slice(0, 3).map((ex: any) => (
                <div key={ex.id} className="flex items-center gap-2 text-xs">
                  {ex.status === 'APPROVED' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  {ex.status === 'DENIED' && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                  {ex.status === 'PENDING' && <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                  <span className="truncate flex-1">{ex.event?.title}</span>
                  <span className="text-muted-foreground shrink-0">{formatDate(ex.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit excuse button */}
        <Button variant="outline" className="w-full" onClick={onExcuseClick}>
          <FileText className="h-3.5 w-3.5 mr-1.5" /> Submit absence excuse
        </Button>
      </CardContent>
    </Card>
  )
}

function ExcuseDialog({ childId, childName, parentUserId, onClose, onSubmitted }: {
  childId: string, childName: string, parentUserId: string, onClose: () => void, onSubmitted: () => void
}) {
  const [reason, setReason] = useState('ILLNESS')
  const [description, setDescription] = useState('')
  const [eventId, setEventId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // We need to fetch the child's upcoming events to pick which one they'll miss.
  // For simplicity, we'll just allow free-text event title and date, OR pick from a list.
  // Actually, let me fetch the events through the parent endpoint response — but we don't have it here.
  // Let me fetch upcoming events for this child.
  const { data: eventsData } = useFetch<any>(`/api/me/parent`)
  const child = eventsData?.children?.find((c: any) => c.student.id === childId)
  const upcomingEvents = child?.upcomingEvents || []

  const submit = async () => {
    if (!reason) { toast.error('Please select a reason'); return }
    if (!description) { toast.error('Please describe the absence'); return }
    if (!eventId) { toast.error('Please select an event'); return }
    setSubmitting(true)
    try {
      await apiPost('/api/attendance-excuses', {
        eventId,
        userId: childId,
        reason,
        description,
        submittedById: parentUserId,
      })
      toast.success(`Excuse submitted for ${childName}`)
      onSubmitted()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit absence excuse</DialogTitle>
          <DialogDescription>
            For <span className="font-semibold">{childName}</span>. The club advisor will review and respond.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {upcomingEvents.length === 0 ? (
                  <SelectItem value="_none" disabled>No upcoming events</SelectItem>
                ) : (
                  upcomingEvents.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title} — {formatDate(e.startTime)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ILLNESS">Illness / medical</SelectItem>
                <SelectItem value="FAMILY">Family emergency</SelectItem>
                <SelectItem value="ACADEMIC">Academic conflict (test, exam)</SelectItem>
                <SelectItem value="EXTRACURRICULAR">Other extracurricular conflict</SelectItem>
                <SelectItem value="TRANSPORTATION">Transportation issue</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Details</Label>
            <Textarea
              rows={3}
              placeholder="Please provide any details that may help the advisor understand the absence."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Submit excuse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
