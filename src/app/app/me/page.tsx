'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFetch } from '@/lib/clubhub/hooks'
import { useDarkMode } from '@/lib/clubhub/use-dark-mode'
import { useAuth } from '@/lib/clubhub/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Loader2, ArrowRight, Calendar, Users, Trophy, Flame, Heart,
  CalendarCheck, CheckCircle2, ClipboardList, CheckSquare, MapPin, Clock,
  Award, TrendingUp, Moon, Sun, Home, ChevronRight, Bell, AlertCircle,
  GraduationCap, Building2, Mail,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import { formatDate, formatTime, initials, avatarColor, categoryEmoji, statusColor, statusLabel } from '@/lib/clubhub/types'

const ROLE_LABEL: Record<string, string> = {
  PRESIDENT: 'President', VICE_PRESIDENT: 'VP', SECRETARY: 'Secretary',
  TREASURER: 'Treasurer', COMMITTEE_HEAD: 'Head', MEMBER: 'Member', ADVISOR: 'Advisor',
}

export default function StudentDashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { data, loading } = useFetch<any>('/api/me')
  const { dark, toggle: toggleDark } = useDarkMode()

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/app/me')
  }, [authLoading, user, router])


  if (authLoading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }
  if (!user) return null

  const stats = data?.stats || {}
  const memberships = data?.memberships || []
  const upcomingEvents = data?.upcomingEvents || []
  const recentAttendance = data?.recentAttendance || []
  const badges = data?.badges || []
  const pendingTasks = data?.pendingTasks || []
  const pendingForms = data?.pendingForms || []
  const pendingRsvps = data?.pendingRsvps || []
  const perClub = data?.perClubAttendance || []

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — civic */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              my dashboard
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app"><Building2 className="h-3.5 w-3.5 mr-1" /> Admin view</Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" asChild title="Sign out">
              <Link href="/login"><Home className="h-4 w-4" /></Link>
            </Button>
            <Avatar className="h-8 w-8" style={{ backgroundColor: avatarColor(user.name) }}>
              <AvatarFallback className="text-white text-xs font-medium">{initials(user.name)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 md:py-8 space-y-6">
        {/* Greeting */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Welcome back,</div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{user.name.split(' ')[0]} 👋</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here's your club life at a glance — {memberships.length} club{memberships.length !== 1 ? 's' : ''}, {stats.attendedEvents || 0} events attended, {stats.streak || 0}-event streak going.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/discover"><Users className="h-3.5 w-3.5 mr-1" /> Find more clubs</Link>
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <KpiCard icon={<Users />} label="My Clubs" value={stats.totalClubs ?? 0} color="#10b981" loading={loading} />
          <KpiCard icon={<CalendarCheck />} label="Events Attended" value={stats.attendedEvents ?? 0} color="#6366f1" loading={loading} />
          <KpiCard icon={<TrendingUp />} label="Attendance Rate" value={`${stats.attendanceRate ?? 0}%`} color="#06b6d4" loading={loading} />
          <KpiCard icon={<Flame />} label="Current Streak" value={stats.streak ?? 0} color="#f59e0b" loading={loading} />
          <KpiCard icon={<Trophy />} label="Total Points" value={stats.totalPoints ?? 0} color="#ec4899" loading={loading} />
          <KpiCard icon={<Heart />} label="Volunteer Hours" value={stats.totalVolunteerHours ?? 0} color="#ef4444" loading={loading} />
        </div>

        {/* Two-column: action items + upcoming events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Action items */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand" /> Action Items
              </CardTitle>
              <CardDescription>Things you need to do this week</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
              ) : (
                <>
                  {pendingRsvps.length > 0 && (
                    <ActionGroup
                      icon={<Calendar className="h-4 w-4" />}
                      color="indigo"
                      title="RSVP needed"
                      items={pendingRsvps.map((e: any) => ({
                        id: e.id,
                        title: e.title,
                        sub: `${formatDate(e.startTime)} · ${e.club.name}`,
                        href: `/portal/${e.club.id}`,
                      }))}
                    />
                  )}
                  {pendingForms.length > 0 && (
                    <ActionGroup
                      icon={<ClipboardList className="h-4 w-4" />}
                      color="amber"
                      title="Forms to fill"
                      items={pendingForms.map((f: any) => ({
                        id: f.id,
                        title: f.title,
                        sub: `Due ${f.deadline ? formatDate(f.deadline) : 'soon'} · ${f.club.name}`,
                      }))}
                    />
                  )}
                  {pendingTasks.length > 0 && (
                    <ActionGroup
                      icon={<CheckSquare className="h-4 w-4" />}
                      color="rose"
                      title="Tasks assigned"
                      items={pendingTasks.map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        sub: `${t.dueDate ? 'Due ' + formatDate(t.dueDate) : 'No due date'} · ${t.club.name}`,
                      }))}
                    />
                  )}
                  {pendingRsvps.length === 0 && pendingForms.length === 0 && pendingTasks.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                      <div className="text-sm font-medium">All caught up!</div>
                      <div className="text-xs text-muted-foreground mt-1">Nothing pending right now.</div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Upcoming events */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand" /> Upcoming Events
              </CardTitle>
              <CardDescription>Next 10 events across all your clubs</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <div className="text-sm font-medium">No upcoming events</div>
                  <div className="text-xs text-muted-foreground mt-1">Check back soon or browse more clubs.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((e: any) => {
                    const startDate = new Date(e.startTime)
                    const hasRsvp = e.rsvps && e.rsvps.length > 0
                    return (
                      <Link
                        key={e.id}
                        href={`/portal/${e.club.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:border-brand/30 hover:bg-accent/30 transition-colors group"
                      >
                        <div
                          className="flex flex-col items-center justify-center min-w-[3rem] h-14 rounded-lg text-white font-semibold shadow-sm"
                          style={{ backgroundColor: e.club.primaryColor || '#6366f1' }}
                        >
                          <span className="text-[10px] uppercase leading-none">{startDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                          <span className="text-lg leading-none mt-0.5">{startDate.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate group-hover:text-brand transition-colors">{e.title}</div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(e.startTime)}</span>
                            {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
                            <span className="truncate">{e.club.name}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {hasRsvp ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                              RSVP'd
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-300">
                              RSVP?
                            </Badge>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* My clubs + per-club attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-brand" /> My Clubs
              </CardTitle>
              <CardDescription>Clubs you're an active member of</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : memberships.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <div className="text-sm font-medium">You haven't joined any clubs yet</div>
                  <Button size="sm" variant="outline" asChild className="mt-3">
                    <Link href="/discover">Discover clubs <ArrowRight className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {memberships.map((m: any) => (
                    <Link
                      key={m.id}
                      href={`/portal/${m.club.slug || m.club.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:border-brand/30 hover:bg-accent/30 transition-colors group"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                        style={{ backgroundColor: `${m.club.primaryColor}20` }}
                      >
                        {categoryEmoji(m.club.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate group-hover:text-brand transition-colors">{m.club.name}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{ROLE_LABEL[m.role] || m.role}</Badge>
                          <span>{m.club._count?.members || 0} members</span>
                          {m.club.defaultDay && <><span>·</span><span>{m.club.defaultDay} {m.club.defaultTime || ''}</span></>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-brand" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand" /> Attendance by Club
              </CardTitle>
              <CardDescription>Your attendance rate per club</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : perClub.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No attendance records yet</div>
              ) : (
                <div className="space-y-3">
                  {perClub.map((c: any, i: number) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium truncate">{c.clubName}</span>
                        <span className="text-muted-foreground text-xs">{c.attended}/{c.total} · <span style={{ color: c.rate >= 75 ? '#10b981' : c.rate >= 50 ? '#f59e0b' : '#ef4444' }}>{c.rate}%</span></span>
                      </div>
                      <Progress value={c.rate} className="h-2" style={{ ['--progress-color' as any]: c.clubColor }} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Badges + recent attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-brand" /> Achievements
              </CardTitle>
              <CardDescription>Badges you've earned across your clubs</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : badges.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <div className="text-sm font-medium">No badges yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Attend events to earn your first badge!</div>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {badges.map((ub: any) => (
                    <div key={ub.id} className="text-center p-3 rounded-lg border hover:shadow-sm transition-shadow" style={{ borderColor: `${ub.badge.color}40` }}>
                      <div className="text-3xl mb-1">{ub.badge.icon}</div>
                      <div className="text-xs font-medium truncate" title={ub.badge.name}>{ub.badge.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">+{ub.badge.points} pts</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-brand" /> Recent Attendance
              </CardTitle>
              <CardDescription>Your last 5 check-ins</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : recentAttendance.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">No attendance yet</div>
              ) : (
                <div className="space-y-2">
                  {recentAttendance.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30">
                      <div
                        className="w-2 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: statusColor(a.status) }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{a.event.title}</div>
                        <div className="text-xs text-muted-foreground">{a.event.club.name} · {formatDate(a.event.startTime)}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px]" style={{ color: statusColor(a.status), borderColor: statusColor(a.status) }}>
                        {statusLabel(a.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

function History({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
}

function KpiCard({ icon, label, value, color, loading }: {
  icon: React.ReactNode, label: string, value: number | string, color: string, loading: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground mb-1 truncate">{label}</div>
            {loading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold tracking-tight">{value}</div>}
          </div>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ backgroundColor: `${color}20`, color }}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const ACTION_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-300', border: 'border-indigo-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-300', border: 'border-amber-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-300', border: 'border-rose-500/20' },
}

function ActionGroup({ icon, color, title, items }: {
  icon: React.ReactNode, color: keyof typeof ACTION_COLORS, title: string, items: { id: string, title: string, sub: string, href?: string }[]
}) {
  const c = ACTION_COLORS[color]
  return (
    <div>
      <div className={`text-xs font-semibold mb-1.5 flex items-center gap-1 ${c.text}`}>
        {icon} {title} <Badge variant="outline" className="text-[9px] ml-1">{items.length}</Badge>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <Link
            key={item.id}
            href={item.href || '#'}
            className={`block p-2 rounded-md border ${c.border} ${c.bg} hover:shadow-sm transition-shadow`}
          >
            <div className="text-xs font-medium truncate">{item.title}</div>
            <div className="text-[10px] text-muted-foreground truncate">{item.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
