'use client'

import { useState } from 'react'
import { useFetch } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
 TrendingUp, TrendingDown, Activity, Users, Calendar, Flame, Award, Target,
 Download, BarChart3, LineChart, PieChart, Grid3x3, AlertTriangle, Gauge, Zap, Crown
} from 'lucide-react'
import {
 LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
 BarChart, Bar, PieChart as RPieChart, Pie, Cell, AreaChart, Area, RadialBarChart, RadialBar,
 ScatterChart, Scatter, ZAxis, ComposedChart, Legend
} from 'recharts'
import {
 ATTENDANCE_STATUSES, statusColor, statusEmoji, statusLabel, avatarColor, initials, formatDate
} from '@/lib/clubhub/types'

export function AnalyticsTab({ clubId }: { clubId: string }) {
 const baseUrl = clubId !== 'ALL' ? `&clubId=${clubId}` : ''
 const { data: trends, loading: l1 } = useFetch(`/api/analytics?view=trends${baseUrl}`)
 const { data: heatmap, loading: l2 } = useFetch(`/api/analytics?view=heatmap${baseUrl}`)
 const { data: retention, loading: l3 } = useFetch(`/api/analytics?view=retention${baseUrl}`)
 const { data: engagement, loading: l4 } = useFetch(`/api/analytics?view=engagement${baseUrl}`)
 const { data: comparison, loading: l5 } = useFetch(`/api/analytics?view=comparison${baseUrl}`)

 const tsData = (trends?.timeSeries || []).slice(-26).map((t: any) => ({
 ...t,
 date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
 }))
 const perClub = trends?.perClub || []
 const matrix = heatmap?.matrix || Array.from({ length: 7 }, () => new Array(24).fill(0))
 const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
 const cohortData = retention?.cohorts || []
 const members = engagement?.members || []
 const atRisk = engagement?.atRisk || []
 const topPerformers = engagement?.topPerformers || []
 const clubsData = comparison?.clubs || []

 // Heatmap max for color scaling
 const maxHeat = Math.max(...matrix.flat(), 1)

 // Export
 const exportAnalytics = () => {
 const csv = [
 'Metric,Value',
 `Total Members,${engagement?.total || 0}`,
 `At-Risk Members,${engagement?.atRiskCount || 0}`,
 `Avg Engagement,${engagement?.avgEngagement || 0}`,
 `Total Clubs,${clubsData.length}`,
 ``,
 `Club,Active Members,Events,Attendance Rate,Badges`,
 ...clubsData.map((c: any) => `${c.name},${c.activeMembers},${c.totalEvents},${c.attendanceRate}%,${c.badgesAwarded}`)
 ].join('\n')
 const blob = new Blob([csv], { type: 'text/csv' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `analytics_${new Date().toISOString().slice(0, 10)}.csv`
 a.click()
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">In-House Analytics</h2>
 <p className="text-sm text-muted-foreground">Deep insights into attendance, engagement, and retention.</p>
 </div>
 <Button variant="outline" size="sm" onClick={exportAnalytics}>
 <Download className="h-3.5 w-3.5" /> Export Report
 </Button>
 </div>

 <Tabs defaultValue="trends">
 <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 max-w-3xl">
 <TabsTrigger value="trends"><LineChart className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="heatmap"><Grid3x3 className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="engagement"><Gauge className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="retention"><Users className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="comparison"><BarChart3 className="h-3.5 w-3.5" /></TabsTrigger>
 </TabsList>

 {/* TRENDS */}
 <TabsContent value="trends" className="space-y-4">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 <Card className="lg:col-span-2">
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Attendance Trend</CardTitle>
 <CardDescription>Weekly attendance rate over 6 months</CardDescription>
 </CardHeader>
 <CardContent>
 {l1 ? <Skeleton className="h-72 w-full" /> : (
 <ResponsiveContainer width="100%" height={300}>
 <AreaChart data={tsData}>
 <defs>
 <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={2} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
 <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} fill="url(#g1)" name="Rate %" />
 <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={1.5} fill="transparent" name="Present count" />
 </AreaChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Trend Summary</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 {(() => {
 if (!tsData || tsData.length < 2) return <div className="text-sm text-muted-foreground">Not enough data</div>
 const last = tsData[tsData.length - 1].rate
 const prev = tsData[tsData.length - 2].rate
 const change = last - prev
 const avg = tsData.reduce((s: number, t: any) => s + t.rate, 0) / tsData.length
 const max = Math.max(...tsData.map((t: any) => t.rate))
 const min = Math.min(...tsData.map((t: any) => t.rate))
 return (
 <>
 <StatRow label="Current Rate" value={`${last}%`} trend={change} />
 <StatRow label="6-month Average" value={`${Math.round(avg * 10) / 10}%`} />
 <StatRow label="Peak" value={`${max}%`} />
 <StatRow label="Low" value={`${min}%`} />
 <StatRow label="Weeks Tracked" value={String(tsData.length)} />
 </>
 )
 })()}
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>Attendance Volume by Week</CardTitle>
 <CardDescription>Total attendance records per week (present vs absent)</CardDescription>
 </CardHeader>
 <CardContent>
 {l1 ? <Skeleton className="h-64 w-full" /> : (
 <ResponsiveContainer width="100%" height={260}>
 <ComposedChart data={tsData}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={2} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
 <Bar dataKey="present" stackId="a" fill="#10b981" name="Present" />
 <Bar dataKey="total" stackId="a" fill="#fee2e2" name="Total" />
 </ComposedChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* HEATMAP */}
 <TabsContent value="heatmap" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Grid3x3 className="h-5 w-5" /> Attendance Heatmap</CardTitle>
 <CardDescription>When are members most likely to attend? Darker = more attendance.</CardDescription>
 </CardHeader>
 <CardContent>
 {l2 ? <Skeleton className="h-72 w-full" /> : (
 <div className="overflow-x-auto">
 <div className="min-w-[800px]">
 <div className="grid grid-cols-[60px_repeat(24,_1fr)] gap-0.5 text-xs">
 <div></div>
 {Array.from({ length: 24 }).map((_, h) => (
 <div key={h} className="text-center text-muted-foreground text-[10px] py-1">
 {h === 0 ? '' : `${h}h`}
 </div>
 ))}
 {matrix.map((row, dow) => (
 <>
 <div key={`l-${dow}`} className="flex items-center justify-end pr-2 font-medium text-xs">{dayNames[dow]}</div>
 {row.map((v, h) => {
 const intensity = v / maxHeat
 const bg = v === 0 ? 'hsl(var(--muted))' : `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`
 return (
 <div
 key={`${dow}-${h}`}
 className="aspect-square rounded flex items-center justify-center text-[10px] font-medium hover:ring-2 ring-foreground cursor-pointer transition-all"
 style={{ backgroundColor: bg, color: intensity > 0.5 ? 'white' : 'hsl(var(--foreground))' }}
 title={`${dayNames[dow]} ${h}:00 — ${v} attendees`}
 >
 {v > 0 && v}
 </div>
 )
 })}
 </>
 ))}
 </div>
 <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
 <span>Less</span>
 {[0.1, 0.3, 0.5, 0.7, 1].map(i => (
 <div key={i} className="w-5 h-5 rounded" style={{ backgroundColor: `rgba(16, 185, 129, ${0.15 + i * 0.85})` }} />
 ))}
 <span>More</span>
 </div>
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* ENGAGEMENT */}
 <TabsContent value="engagement" className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <KpiCard icon={<Users className="h-4 w-4" />} label="Total Members" value={engagement?.total || 0} color="#6366f1" />
 <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="At Risk" value={engagement?.atRiskCount || 0} color="#ef4444" />
 <KpiCard icon={<Gauge className="h-4 w-4" />} label="Avg Engagement" value={engagement?.avgEngagement || 0} color="#10b981" />
 <KpiCard icon={<Crown className="h-4 w-4" />} label="Top Score" value={topPerformers[0]?.engagementScore || 0} color="#f59e0b" />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-foreground" /> At-Risk Members</CardTitle>
 <CardDescription>Members with attendance below 50% — needs intervention.</CardDescription>
 </CardHeader>
 <CardContent>
 {l4 ? <Skeleton className="h-64 w-full" /> : atRisk.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">🎉 No at-risk members!</div>
 ) : (
 <ScrollArea className="h-72">
 <div className="space-y-2">
 {atRisk.map((m: any) => (
 <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border">
 <Avatar className="h-9 w-9" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-xs">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground">{m.club?.name}</div>
 </div>
 <div className="text-right">
 <div className="font-bold text-foreground">{m.attendanceRate}%</div>
 <div className="text-xs text-muted-foreground">{m.totalEvents} events</div>
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-foreground" /> Top Performers</CardTitle>
 <CardDescription>Highest engagement scores</CardDescription>
 </CardHeader>
 <CardContent>
 {l4 ? <Skeleton className="h-64 w-full" /> : (
 <ScrollArea className="h-72">
 <div className="space-y-2">
 {topPerformers.slice(0, 20).map((m: any, i: number) => (
 <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border">
 <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
 style={{ backgroundColor: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : 'hsl(var(--muted))', color: i < 3 ? 'white' : 'hsl(var(--muted-foreground))' }}>
 {i + 1}
 </div>
 <Avatar className="h-9 w-9" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-xs">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground flex items-center gap-2">
 <Flame className="h-3 w-3 text-foreground" />{m.streak}
 <span>·</span>
 <Award className="h-3 w-3 text-foreground" />{m.points} pts
 </div>
 </div>
 <div className="text-right">
 <div className="font-bold text-foreground">{m.engagementScore}</div>
 <div className="text-xs text-muted-foreground">{m.attendanceRate}%</div>
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>Engagement Distribution</CardTitle>
 <CardDescription>How engagement scores are distributed across members</CardDescription>
 </CardHeader>
 <CardContent>
 {l4 ? <Skeleton className="h-64 w-full" /> : (
 <ResponsiveContainer width="100%" height={260}>
 <BarChart data={(() => {
 const buckets = [
 { range: '0-20', min: 0, max: 20, count: 0 },
 { range: '21-40', min: 21, max: 40, count: 0 },
 { range: '41-60', min: 41, max: 60, count: 0 },
 { range: '61-80', min: 61, max: 80, count: 0 },
 { range: '81-100', min: 81, max: 100, count: 0 },
 { range: '100+', min: 101, max: 9999, count: 0 },
 ]
 members.forEach((m: any) => {
 const b = buckets.find(b => m.engagementScore >= b.min && m.engagementScore <= b.max)
 if (b) b.count++
 })
 return buckets
 })()}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
 <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* RETENTION */}
 <TabsContent value="retention" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Member Retention Cohorts</CardTitle>
 <CardDescription>Retention rate by join month — when do members stay vs leave?</CardDescription>
 </CardHeader>
 <CardContent>
 {l3 ? <Skeleton className="h-72 w-full" /> : cohortData.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No retention data</div>
 ) : (
 <ResponsiveContainer width="100%" height={300}>
 <BarChart data={cohortData.map((c: any) => ({ ...c, monthLabel: new Date(c.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }))}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis dataKey="monthLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
 <Legend />
 <Bar dataKey="size" fill="#6366f1" name="Joined" radius={[4, 4, 0, 0]} />
 <Bar dataKey="retained" fill="#10b981" name="Retained" radius={[4, 4, 0, 0]} />
 </BarChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Retention Rate Trend</CardTitle>
 <CardDescription>% of cohort still active</CardDescription>
 </CardHeader>
 <CardContent>
 {l3 ? <Skeleton className="h-64 w-full" /> : (
 <ResponsiveContainer width="100%" height={240}>
 <RLineChart data={cohortData.map((c: any) => ({ ...c, monthLabel: new Date(c.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }))}>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis dataKey="monthLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} unit="%" />
 <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
 <Line type="monotone" dataKey="retentionRate" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
 </RLineChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* COMPARISON */}
 <TabsContent value="comparison" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Club Comparison</CardTitle>
 <CardDescription>Side-by-side metrics across all clubs</CardDescription>
 </CardHeader>
 <CardContent>
 {l5 ? <Skeleton className="h-96 w-full" /> : clubsData.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No data</div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Club</TableHead>
 <TableHead className="text-right">Members</TableHead>
 <TableHead className="text-right">Events</TableHead>
 <TableHead className="text-right">Records</TableHead>
 <TableHead className="text-right">Rate</TableHead>
 <TableHead className="text-right">Badges</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {clubsData.map((c: any) => (
 <TableRow key={c.id}>
 <TableCell>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
 <span className="font-medium">{c.name}</span>
 <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
 </div>
 </TableCell>
 <TableCell className="text-right font-medium">{c.activeMembers}</TableCell>
 <TableCell className="text-right font-medium">{c.totalEvents}</TableCell>
 <TableCell className="text-right font-medium">{c.totalAttendance}</TableCell>
 <TableCell className="text-right">
 <span className="font-bold" style={{ color: c.attendanceRate > 75 ? '#10b981' : c.attendanceRate > 50 ? '#f59e0b' : '#ef4444' }}>
 {c.attendanceRate}%
 </span>
 </TableCell>
 <TableCell className="text-right font-medium">{c.badgesAwarded}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <Card>
 <CardHeader>
 <CardTitle>Active Members by Club</CardTitle>
 </CardHeader>
 <CardContent>
 {l5 ? <Skeleton className="h-64 w-full" /> : (
 <ResponsiveContainer width="100%" height={260}>
 <BarChart data={clubsData} layout="vertical">
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
 <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
 <Bar dataKey="activeMembers" radius={[0, 6, 6, 0]}>
 {clubsData.map((c: any, i: number) => <Cell key={i} fill={c.color} />)}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Attendance Rate vs Badges Awarded</CardTitle>
 <CardDescription>Do gamified clubs have better attendance?</CardDescription>
 </CardHeader>
 <CardContent>
 {l5 ? <Skeleton className="h-64 w-full" /> : (
 <ResponsiveContainer width="100%" height={260}>
 <ScatterChart>
 <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
 <XAxis type="number" dataKey="attendanceRate" name="Attendance Rate" unit="%" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
 <YAxis type="number" dataKey="badgesAwarded" name="Badges" stroke="hsl(var(--muted-foreground))" fontSize={11} />
 <ZAxis range={[200, 200]} />
 <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
 formatter={(v: any, n: any) => n === 'Attendance Rate' ? [`${v}%`, n] : [v, n]}
 labelFormatter={() => ''}
 />
 <Scatter data={clubsData}>
 {clubsData.map((c: any, i: number) => <Cell key={i} fill={c.color} />)}
 </Scatter>
 </ScatterChart>
 </ResponsiveContainer>
 )}
 </CardContent>
 </Card>
 </div>
 </TabsContent>
 </Tabs>
 </div>
 )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number | string, color: string }) {
 return (
 <Card>
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div>
 <div className="text-xs text-muted-foreground">{label}</div>
 <div className="text-2xl font-bold mt-1">{value}</div>
 </div>
 <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, color }}>{icon}</div>
 </div>
 </CardContent>
 </Card>
 )
}

function StatRow({ label, value, trend }: { label: string, value: string, trend?: number }) {
 return (
 <div className="flex items-center justify-between py-2 border-b last:border-0">
 <span className="text-sm text-muted-foreground">{label}</span>
 <div className="flex items-center gap-2">
 {trend !== undefined && (
 <span className={`text-xs flex items-center gap-0.5 ${trend > 0 ? 'text-foreground' : trend < 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
 {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
 {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
 </span>
 )}
 <span className="font-semibold">{value}</span>
 </div>
 </div>
 )
}
