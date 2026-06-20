'use client'

import { useFetch } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
 Users, Calendar, TrendingUp, Award, AlertTriangle, Activity,
 Flame, Trophy, ArrowUpRight, ArrowDownRight, Clock, MapPin
} from 'lucide-react'
import {
 LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart, RadialBarChart, RadialBar, Legend
} from 'recharts'
import {
 ATTENDANCE_STATUSES, CLUB_CATEGORIES, formatDate, formatTime, timeAgo,
 categoryEmoji, statusColor, statusLabel, statusEmoji, initials, avatarColor
} from '@/lib/clubhub/types'

export function DashboardTab({ clubId }: { clubId: string }) {
 const overviewUrl = `/api/analytics?view=overview${clubId !== 'ALL' ? `&clubId=${clubId}` : ''}`
 const trendsUrl = `/api/analytics?view=trends${clubId !== 'ALL' ? `&clubId=${clubId}` : ''}`
 const engagementUrl = `/api/analytics?view=engagement${clubId !== 'ALL' ? `&clubId=${clubId}` : ''}`
 const eventsUrl = `/api/events?upcoming=true&limit=5${clubId !== 'ALL' ? `&clubId=${clubId}` : ''}`

 const { data: overview, loading: l1 } = useFetch(overviewUrl)
 const { data: trends, loading: l2 } = useFetch(trendsUrl)
 const { data: engagement, loading: l3 } = useFetch(engagementUrl)
 const { data: eventsData, loading: l4 } = useFetch(eventsUrl)

 const kpis = overview?.kpis
 const tsData = (trends?.timeSeries || []).slice(-12).map((t: any) => ({
 ...t,
 date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
 }))
 const perClub = trends?.perClub || []
 const statusBreakdown = kpis?.statusBreakdown || {}
 const upcomingEvents = eventsData?.events || []
 const atRisk = engagement?.atRisk?.slice(0, 5) || []
 const topPerformers = engagement?.topPerformers?.slice(0, 5) || []

 return (
 <div className="space-y-6">
 {/* KPI Cards */}
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
 <KpiCard
 icon={<Users className="h-5 w-5" />}
 label="Active Members"
 value={kpis?.totalMembers ?? 0}
 loading={l1}
 color="#10b981"
 />
 <KpiCard
 icon={<Calendar className="h-5 w-5" />}
 label="Total Events"
 value={kpis?.totalEvents ?? 0}
 loading={l1}
 color="#6366f1"
 />
 <KpiCard
 icon={<Activity className="h-5 w-5" />}
 label="Attendance Records"
 value={kpis?.totalAttendance ?? 0}
 loading={l1}
 color="#f59e0b"
 />
 <KpiCard
 icon={<TrendingUp className="h-5 w-5" />}
 label="Attendance Rate"
 value={`${kpis?.overallAttendanceRate ?? 0}%`}
 loading={l1}
 color="#06b6d4"
 />
 <KpiCard
 icon={<Trophy className="h-5 w-5" />}
 label="Active Clubs"
 value={kpis?.totalClubs ?? 0}
 loading={l1}
 color="#ec4899"
 />
 <KpiCard
 icon={<AlertTriangle className="h-5 w-5" />}
 label="At-Risk Members"
 value={engagement?.atRiskCount ?? 0}
 loading={l3}
 color="#ef4444"
 />
 </div>

 {/* Trends chart + status breakdown */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <Card className="lg:col-span-2">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <TrendingUp className="h-5 w-5" />
 Attendance Trends
 </CardTitle>
 <CardDescription>Weekly attendance rate over the past 12 weeks</CardDescription>
 </CardHeader>
 <CardContent>
 {l2 ? (
 <Skeleton className="h-64 w-full" />
 ) : (
 <ResponsiveContainer width="100%" height={280}>
 <AreaChart data={tsData}>
 <defs>
 <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
 </linearGradient>
 <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
 <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <Tooltip
 contentStyle={{
 backgroundColor: 'hsl(var(--background))',
 border: '1px solid hsl(var(--border))',
 borderRadius: '8px',
 fontSize: '12px'
 }}
 />
 <Area type="monotone" dataKey="present" stroke="#6366f1" fillOpacity={1} fill="url(#colorPresent)" name="Present" />
 <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" name="Rate %" />
 </AreaChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Attendance Breakdown</CardTitle>
 <CardDescription>Status distribution</CardDescription>
 </CardHeader>
 <CardContent>
 {l1 ? (
 <Skeleton className="h-64 w-full" />
 ) : (
 <div className="space-y-3">
 <ResponsiveContainer width="100%" height={180}>
 <PieChart>
 <Pie
 data={ATTENDANCE_STATUSES.filter(s => (statusBreakdown[s.value] || 0) > 0).map(s => ({
 name: s.label,
 value: statusBreakdown[s.value] || 0,
 color: s.color
 }))}
 dataKey="value"
 cx="50%"
 cy="50%"
 innerRadius={45}
 outerRadius={75}
 paddingAngle={2}
 >
 {ATTENDANCE_STATUSES.filter(s => (statusBreakdown[s.value] || 0) > 0).map((s) => (
 <Cell key={s.value} fill={s.color} />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 backgroundColor: 'hsl(var(--background))',
 border: '1px solid hsl(var(--border))',
 borderRadius: '8px',
 fontSize: '12px'
 }}
 />
 </PieChart>
 </ResponsiveContainer>
 <div className="space-y-1.5">
 {ATTENDANCE_STATUSES.filter(s => (statusBreakdown[s.value] || 0) > 0).map(s => (
 <div key={s.value} className="flex items-center justify-between text-sm">
 <div className="flex items-center gap-2">
 <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
 <span className="text-muted-foreground">{s.emoji} {s.label}</span>
 </div>
 <span className="font-medium">{statusBreakdown[s.value]}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Per-club comparison + Upcoming events */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <Card>
 <CardHeader>
 <CardTitle>Club Comparison</CardTitle>
 <CardDescription>Attendance rate by club</CardDescription>
 </CardHeader>
 <CardContent>
 {l2 ? (
 <Skeleton className="h-64 w-full" />
 ) : perClub.length === 0 ? (
 <div className="text-sm text-muted-foreground text-center py-12">No data</div>
 ) : (
 <ResponsiveContainer width="100%" height={260}>
 <BarChart data={perClub} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
 <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
 <YAxis dataKey="clubName" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} tick={{ fill: 'hsl(var(--foreground))' }} />
 <Tooltip
 contentStyle={{
 backgroundColor: 'hsl(var(--background))',
 border: '1px solid hsl(var(--border))',
 borderRadius: '8px',
 fontSize: '12px'
 }}
 formatter={(v: any) => [`${v}%`, 'Attendance Rate']}
 />
 <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
 {perClub.map((c: any, i: number) => (
 <Cell key={i} fill={c.color} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Upcoming Events</CardTitle>
 <CardDescription>Next 5 scheduled events</CardDescription>
 </CardHeader>
 <CardContent>
 {l4 ? (
 <div className="space-y-3">
 {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
 </div>
 ) : upcomingEvents.length === 0 ? (
 <div className="text-sm text-muted-foreground text-center py-12">No upcoming events</div>
 ) : (
 <div className="space-y-3 max-h-80 overflow-y-auto">
 {upcomingEvents.map((e: any) => (
 <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
 <div
 className="flex flex-col items-center justify-center min-w-[3rem] h-14 rounded-lg text-white font-semibold"
 style={{ backgroundColor: e.club?.primaryColor || '#6366f1' }}
 >
 <span className="text-xs uppercase">{new Date(e.startTime).toLocaleDateString('en-US', { month: 'short' })}</span>
 <span className="text-lg leading-none">{new Date(e.startTime).getDate()}</span>
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{e.title}</div>
 <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
 <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(e.startTime)}</span>
 {e.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>}
 </div>
 <div className="flex items-center gap-2 mt-1.5">
 <Badge variant="outline" className="text-[10px] px-1.5 py-0">{e.type}</Badge>
 <span className="text-xs text-muted-foreground">{e.club?.name}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 {/* At-risk members + Top performers */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <AlertTriangle className="h-5 w-5 text-foreground" />
 At-Risk Members
 </CardTitle>
 <CardDescription>Attendance below 50% — needs outreach</CardDescription>
 </CardHeader>
 <CardContent>
 {l3 ? (
 <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
 ) : atRisk.length === 0 ? (
 <div className="text-sm text-muted-foreground text-center py-8">🎉 No at-risk members</div>
 ) : (
 <div className="space-y-2">
 {atRisk.map((m: any) => (
 <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
 <Avatar className="h-9 w-9" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-xs font-medium">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground truncate">
 Grade {m.user.grade} · {m.club?.name}
 </div>
 </div>
 <div className="text-right">
 <div className="text-sm font-bold text-foreground">{m.attendanceRate}%</div>
 <div className="text-xs text-muted-foreground">{m.totalEvents} events</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Trophy className="h-5 w-5 text-foreground" />
 Top Performers
 </CardTitle>
 <CardDescription>Highest engagement scores</CardDescription>
 </CardHeader>
 <CardContent>
 {l3 ? (
 <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
 ) : topPerformers.length === 0 ? (
 <div className="text-sm text-muted-foreground text-center py-8">No data yet</div>
 ) : (
 <div className="space-y-2">
 {topPerformers.map((m: any, i: number) => (
 <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
 <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
 style={{
 backgroundColor: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : 'hsl(var(--muted))',
 color: i < 3 ? 'white' : 'hsl(var(--muted-foreground))'
 }}
 >
 {i + 1}
 </div>
 <Avatar className="h-9 w-9" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-xs font-medium">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
 <Flame className="h-3 w-3 text-foreground" />{m.streak} streak · {m.points} pts
 </div>
 </div>
 <div className="text-right">
 <div className="text-sm font-bold text-foreground">{m.engagementScore}</div>
 <div className="text-xs text-muted-foreground">score</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 )
}

function KpiCard({ icon, label, value, loading, color }: {
 icon: React.ReactNode
 label: string
 value: number | string
 loading: boolean
 color: string
}) {
 return (
 <Card>
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div className="min-w-0">
 <div className="text-xs text-muted-foreground mb-1 truncate">{label}</div>
 {loading ? (
 <Skeleton className="h-7 w-16" />
 ) : (
 <div className="text-2xl font-bold tracking-tight">{value}</div>
 )}
 </div>
 <div className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0" style={{ backgroundColor: `${color}20`, color }}>
 {icon}
 </div>
 </div>
 </CardContent>
 </Card>
 )
}
