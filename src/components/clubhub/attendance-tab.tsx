'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { QRCodeSVG } from 'qrcode.react'
import {
 QrCode, ScanLine, CheckCircle2, Clock, XCircle, Smartphone, Monitor, UserCheck,
 Calendar, Search, Users, AlertCircle, Zap, History, ChevronRight
} from 'lucide-react'
import {
 ATTENDANCE_STATUSES, CHECKIN_METHODS, statusColor, statusEmoji, statusLabel,
 eventTypeEmoji, formatDateTime, formatTime, initials, avatarColor, type ClubEvent
} from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function AttendanceTab({ clubId }: { clubId: string }) {
 return (
 <Tabs defaultValue="kiosk" className="space-y-4">
 <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl">
 <TabsTrigger value="kiosk"><Monitor className="h-3.5 w-3.5 mr-1" /> Kiosk</TabsTrigger>
 <TabsTrigger value="qr"><QrCode className="h-3.5 w-3.5 mr-1" /> QR Code</TabsTrigger>
 <TabsTrigger value="manual"><UserCheck className="h-3.5 w-3.5 mr-1" /> Manual</TabsTrigger>
 <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> History</TabsTrigger>
 </TabsList>

 <TabsContent value="kiosk"><KioskMode clubId={clubId} /></TabsContent>
 <TabsContent value="qr"><QrCheckIn clubId={clubId} /></TabsContent>
 <TabsContent value="manual"><ManualMarking clubId={clubId} /></TabsContent>
 <TabsContent value="history"><AttendanceHistory clubId={clubId} /></TabsContent>
 </Tabs>
 )
}

// ============================================================
// KIOSK MODE — full-screen check-in with student ID entry
// ============================================================
function KioskMode({ clubId }: { clubId: string }) {
 const [selectedEventId, setSelectedEventId] = useState<string>('')
 const [studentId, setStudentId] = useState('')
 const [recentCheckIns, setRecentCheckIns] = useState<any[]>([])
 const [lastAction, setLastAction] = useState<{ name: string, status: string, time: Date } | null>(null)
 const inputRef = useRef<HTMLInputElement>(null)

 const todayUrl = useMemo(() => {
 const now = Date.now()
 return `/api/events?${clubId !== 'ALL' ? `clubId=${clubId}&` : ''}from=${encodeURIComponent(new Date(now - 86400000).toISOString())}&to=${encodeURIComponent(new Date(now + 86400000 * 30).toISOString())}`
 }, [clubId])
 const { data: eventsData, loading } = useFetch<{ events: ClubEvent[] }>(todayUrl)
 const events = useMemo(() => (eventsData?.events || []).filter(e => new Date(e.startTime) > new Date(Date.now() - 86400000)), [eventsData])

 useEffect(() => {
 if (!selectedEventId && events.length > 0) {
 setSelectedEventId(events[0].id)
 }
 }, [events, selectedEventId])

 const handleCheckIn = async () => {
 if (!studentId.trim() || !selectedEventId) return
 try {
 // Find user by student ID
 const userResp = await fetch(`/api/members?${clubId !== 'ALL' ? `clubId=${clubId}&` : ''}search=${encodeURIComponent(studentId.trim())}&limit=5`)
 const userData = await userResp.json()
 const member = userData.members?.[0]
 if (!member) {
 toast.error(`No member found with ID"${studentId}"`)
 setLastAction({ name: 'Unknown', status: 'NOT_FOUND', time: new Date() })
 setStudentId('')
 inputRef.current?.focus()
 return
 }

 const r = await apiPost('/api/attendance/checkin', {
 eventId: selectedEventId,
 userId: member.userId,
 method: 'KIOSK',
 type: 'check-in',
 })

 const newEntry = {
 name: member.user.name,
 status: r.status,
 time: new Date(),
 studentId: member.user.studentId,
 }
 setRecentCheckIns(prev => [newEntry, ...prev].slice(0, 20))
 setLastAction(newEntry)
 setStudentId('')
 inputRef.current?.focus()
 } catch (e: any) {
 toast.error(e.message)
 }
 }

 const selectedEvent = events.find(e => e.id === selectedEventId)

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5" /> Kiosk Check-In Mode</CardTitle>
 <CardDescription>Display this on a tablet or laptop at the door. Members enter their student ID to check in.</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
 <div className="md:col-span-2">
 <Label>Select Event</Label>
 <Select value={selectedEventId} onValueChange={setSelectedEventId}>
 <SelectTrigger><SelectValue placeholder="Choose an event..." /></SelectTrigger>
 <SelectContent>
 {events.map(e => (
 <SelectItem key={e.id} value={e.id}>
 {eventTypeEmoji(e.type)} {e.title} — {formatDateTime(e.startTime)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Method</Label>
 <div className="flex items-center h-10 px-3 rounded-md border bg-muted/30">
 <Monitor className="h-4 w-4 mr-2 text-muted-foreground" />
 <span className="text-sm">Kiosk</span>
 </div>
 </div>
 </div>

 {selectedEvent && (
 <div className="rounded-lg border bg-muted/20 p-4 mb-4">
 <div className="flex items-center justify-between flex-wrap gap-2">
 <div>
 <div className="font-semibold text-lg">{selectedEvent.title}</div>
 <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
 <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(selectedEvent.startTime)}</span>
 {selectedEvent.location && <span>📍 {selectedEvent.location}</span>}
 </div>
 </div>
 <Badge variant="outline" className="text-xs">
 {recentCheckIns.length} checked in
 </Badge>
 </div>
 </div>
 )}

 <div className="space-y-3">
 <Label className="text-base">Student ID</Label>
 <div className="flex gap-2">
 <Input
 ref={inputRef}
 value={studentId}
 onChange={(e) => setStudentId(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleCheckIn()}
 placeholder="Scan or type student ID..."
 className="text-2xl h-16 font-mono"
 autoFocus
 />
 <Button size="lg" onClick={handleCheckIn} disabled={!studentId || !selectedEventId} className="px-8">
 <Zap className="h-5 w-5" />
 </Button>
 </div>
 </div>

 {lastAction && (
 <div className="mt-4 p-4 rounded-lg" style={{
 backgroundColor: lastAction.status === 'PRESENT' ? '#10b98120' :
 lastAction.status === 'LATE' ? '#f59e0b20' : '#ef444420',
 border: `1px solid ${lastAction.status === 'PRESENT' ? '#10b981' :
 lastAction.status === 'LATE' ? '#f59e0b' : '#ef4444'}`
 }}>
 <div className="flex items-center justify-between">
 <div>
 <div className="font-bold text-xl">{lastAction.name}</div>
 <div className="text-sm text-muted-foreground">
 {lastAction.status === 'NOT_FOUND' ? 'Member not found' :
 `Marked as ${statusLabel(lastAction.status)} at ${formatTime(lastAction.time)}`}
 </div>
 </div>
 <div className="text-3xl">{statusEmoji(lastAction.status)}</div>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Recent Check-Ins</CardTitle>
 </CardHeader>
 <CardContent>
 {recentCheckIns.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">
 No check-ins yet. Waiting for members...
 </div>
 ) : (
 <ScrollArea className="h-72">
 <div className="space-y-1.5">
 {recentCheckIns.map((c, i) => (
 <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 border">
 <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
 style={{ backgroundColor: avatarColor(c.name) }}
 >
 {initials(c.name)}
 </div>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm">{c.name}</div>
 <div className="text-xs text-muted-foreground">{c.studentId} · {formatTime(c.time)}</div>
 </div>
 <Badge style={{
 backgroundColor: statusColor(c.status) + '20',
 color: statusColor(c.status)
 }} className="text-xs">
 {statusEmoji(c.status)} {statusLabel(c.status)}
 </Badge>
 </div>
 ))}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>
 </div>
 )
}

// ============================================================
// QR CODE — Generate QR code for self check-in
// ============================================================
function QrCheckIn({ clubId }: { clubId: string }) {
 const [selectedEventId, setSelectedEventId] = useState<string>('')
 const todayUrl = useMemo(() => {
 const now = Date.now()
 return `/api/events?${clubId !== 'ALL' ? `clubId=${clubId}&` : ''}from=${encodeURIComponent(new Date(now - 86400000).toISOString())}&to=${encodeURIComponent(new Date(now + 86400000 * 30).toISOString())}`
 }, [clubId])
 const { data: eventsData } = useFetch<{ events: ClubEvent[] }>(todayUrl)
 const events = useMemo(() => (eventsData?.events || []).filter(e => new Date(e.startTime) > new Date(Date.now() - 86400000)), [eventsData])

 useEffect(() => {
 if (!selectedEventId && events.length > 0) setSelectedEventId(events[0].id)
 }, [events, selectedEventId])

 const selectedEvent = events.find(e => e.id === selectedEventId)
 const checkInUrl = typeof window !== 'undefined' && selectedEvent
 ? `${window.location.origin}/?checkin=${selectedEvent.id}`
 : ''

 return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> QR Code Check-In</CardTitle>
 <CardDescription>Display this QR code. Members scan with their phone camera to check in.</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <div>
 <Label>Select Event</Label>
 <Select value={selectedEventId} onValueChange={setSelectedEventId}>
 <SelectTrigger><SelectValue placeholder="Choose event..." /></SelectTrigger>
 <SelectContent>
 {events.map(e => (
 <SelectItem key={e.id} value={e.id}>
 {eventTypeEmoji(e.type)} {e.title} — {formatDateTime(e.startTime)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {selectedEvent && (
 <div className="flex flex-col items-center p-6 rounded-lg border-2 border-dashed bg-muted/20">
 <div className="bg-white p-4">
 <QRCodeSVG
 value={checkInUrl}
 size={256}
 level="H"
 includeMargin
 />
 </div>
 <div className="mt-4 text-center">
 <div className="font-semibold">{selectedEvent.title}</div>
 <div className="text-sm text-muted-foreground">{formatDateTime(selectedEvent.startTime)}</div>
 </div>
 <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
 <Smartphone className="h-3.5 w-3.5" />
 Scan with phone camera to check in
 </div>
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Check-In Stats</CardTitle>
 <CardDescription>Live attendance for the selected event</CardDescription>
 </CardHeader>
 <CardContent>
 {selectedEvent ? (
 <EventCheckInStats eventId={selectedEvent.id} />
 ) : (
 <div className="text-center text-sm text-muted-foreground py-8">
 Select an event to see stats
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )
}

function EventCheckInStats({ eventId }: { eventId: string }) {
 const { data, loading } = useFetch<{ event: any }>(`/api/events/${eventId}`)
 if (loading) return <Skeleton className="h-48 w-full" />
 const event = data?.event
 if (!event) return null

 const stats: Record<string, number> = {}
 event.attendances?.forEach((a: any) => {
 stats[a.status] = (stats[a.status] || 0) + 1
 })
 const total = event.attendances?.length || 0
 const present = (stats.PRESENT || 0) + (stats.LATE || 0) + (stats.VIRTUAL || 0)

 return (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div className="p-3 rounded-lg bg-muted border border-foreground/20">
 <div className="text-3xl font-bold text-foreground">{present}</div>
 <div className="text-xs text-muted-foreground">Checked in</div>
 </div>
 <div className="p-3 rounded-lg bg-muted/50">
 <div className="text-3xl font-bold">{total}</div>
 <div className="text-xs text-muted-foreground">Total records</div>
 </div>
 </div>

 <div className="space-y-2">
 {ATTENDANCE_STATUSES.filter(s => (stats[s.value] || 0) > 0).map(s => (
 <div key={s.value} className="flex items-center justify-between p-2 rounded-lg border">
 <div className="flex items-center gap-2">
 <span className="text-lg">{s.emoji}</span>
 <span className="text-sm font-medium">{s.label}</span>
 </div>
 <Badge style={{ backgroundColor: s.color + '20', color: s.color }}>{stats[s.value]}</Badge>
 </div>
 ))}
 </div>

 <div className="text-xs text-muted-foreground text-center pt-2">
 Last updated: {new Date().toLocaleTimeString()}
 </div>
 </div>
 )
}

// ============================================================
// MANUAL MARKING — bulk edit attendance for an event
// ============================================================
function ManualMarking({ clubId }: { clubId: string }) {
 const [selectedEventId, setSelectedEventId] = useState<string>('')
 const [search, setSearch] = useState('')

 const eventsUrl = useMemo(() => {
 const now = Date.now()
 return `/api/events?${clubId !== 'ALL' ? `clubId=${clubId}&` : ''}from=${encodeURIComponent(new Date(now - 60 * 86400000).toISOString())}&to=${encodeURIComponent(new Date(now + 30 * 86400000).toISOString())}`
 }, [clubId])
 const { data: eventsData, loading: eventsLoading } = useFetch<{ events: ClubEvent[] }>(eventsUrl)
 const events = eventsData?.events || []

 const eventUrl = selectedEventId ? `/api/events/${selectedEventId}` : null
 const { data: eventData, loading: eventLoading, refetch } = useFetch<{ event: any }>(eventUrl)

 const members = (eventData?.event?.attendances || []).filter((a: any) =>
 !search || a.user.name.toLowerCase().includes(search.toLowerCase()) || a.user.studentId?.includes(search)
 )

 const updateStatus = async (userId: string, status: string) => {
 try {
 await apiPost('/api/attendance', { eventId: selectedEventId, userId, status, method: 'ADVISOR_MARK' })
 refetch()
 } catch (e: any) {
 toast.error(e.message)
 }
 }

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Manual Attendance Marking</CardTitle>
 <CardDescription>Select an event, then mark attendance for each member.</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <div className="md:col-span-2">
 <Label>Select Event</Label>
 <Select value={selectedEventId} onValueChange={setSelectedEventId}>
 <SelectTrigger><SelectValue placeholder="Choose event..." /></SelectTrigger>
 <SelectContent>
 {events.map(e => (
 <SelectItem key={e.id} value={e.id}>
 {eventTypeEmoji(e.type)} {e.title} — {formatDateTime(e.startTime)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 {selectedEventId && (
 <div>
 <Label>Search Member</Label>
 <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ID..." />
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 {selectedEventId && eventLoading && <Skeleton className="h-96 w-full" />}

 {selectedEventId && !eventLoading && eventData?.event && (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">
 {eventData.event.title} — {members.length} members
 </CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 <div className="max-h-[600px] overflow-y-auto">
 <table className="w-full">
 <thead className="sticky top-0 bg-background border-b">
 <tr>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground">Member</th>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground">Current</th>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground">Mark as...</th>
 </tr>
 </thead>
 <tbody>
 {members.map((a: any) => (
 <tr key={a.userId} className="border-b last:border-0 hover:bg-accent/30">
 <td className="p-3">
 <div className="flex items-center gap-3">
 <Avatar className="h-8 w-8" style={{ backgroundColor: avatarColor(a.user.name) }}>
 <AvatarFallback className="text-white text-xs">{initials(a.user.name)}</AvatarFallback>
 </Avatar>
 <div>
 <div className="font-medium text-sm">{a.user.name}</div>
 <div className="text-xs text-muted-foreground">{a.user.studentId} · G{a.user.grade}</div>
 </div>
 </div>
 </td>
 <td className="p-3">
 <Badge style={{ backgroundColor: statusColor(a.status) + '20', color: statusColor(a.status) }} className="text-xs">
 {statusEmoji(a.status)} {statusLabel(a.status)}
 </Badge>
 </td>
 <td className="p-3">
 <div className="flex flex-wrap gap-1">
 {ATTENDANCE_STATUSES.filter(s => s.value !== 'PENDING').map(s => (
 <button
 key={s.value}
 onClick={() => updateStatus(a.userId, s.value)}
 className={`px-2 py-1 rounded text-xs border transition-colors ${
 a.status === s.value
 ? 'bg-foreground text-background border-foreground'
 : 'hover:bg-accent border-input'
 }`}
 title={s.label}
 >
 {s.emoji}
 </button>
 ))}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 )
}

// ============================================================
// HISTORY — Browse past attendance records
// ============================================================
function AttendanceHistory({ clubId }: { clubId: string }) {
 const [statusFilter, setStatusFilter] = useState('ALL')
 const [search, setSearch] = useState('')

 const url = useMemo(() => {
 const from = new Date(Date.now() - 30 * 86400000).toISOString()
 return `/api/attendance?${clubId !== 'ALL' ? `clubId=${clubId}&` : ''}from=${encodeURIComponent(from)}&status=${statusFilter}&limit=200`
 }, [clubId, statusFilter])
 const { data, loading } = useFetch<{ attendance: any[] }>(url)

 const records = (data?.attendance || []).filter(a =>
 !search || a.user.name.toLowerCase().includes(search.toLowerCase())
 )

 return (
 <Card>
 <CardHeader>
 <CardTitle>Attendance History (Last 30 days)</CardTitle>
 <CardDescription>Browse all attendance records. Filter by status or search by member.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex flex-wrap items-center gap-3">
 <div className="relative flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member..." className="pl-9" />
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Statuses</SelectItem>
 {ATTENDANCE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Button variant="outline" onClick={() => window.open(`/api/export?type=attendance${clubId !== 'ALL' ? `&clubId=${clubId}` : ''}`, '_blank')}>
 Export CSV
 </Button>
 </div>

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
 ) : records.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No records found</div>
 ) : (
 <div className="max-h-[600px] overflow-y-auto border rounded-lg">
 <table className="w-full">
 <thead className="sticky top-0 bg-muted/50 border-b">
 <tr>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground">Member</th>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Event</th>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground hidden lg:table-cell">Date</th>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground">Status</th>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground hidden xl:table-cell">Method</th>
 <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground hidden xl:table-cell">Check-in</th>
 </tr>
 </thead>
 <tbody>
 {records.map(r => (
 <tr key={r.id} className="border-b last:border-0 hover:bg-accent/30">
 <td className="p-3">
 <div className="flex items-center gap-2">
 <Avatar className="h-7 w-7" style={{ backgroundColor: avatarColor(r.user.name) }}>
 <AvatarFallback className="text-white text-[10px]">{initials(r.user.name)}</AvatarFallback>
 </Avatar>
 <div className="min-w-0">
 <div className="font-medium text-sm truncate">{r.user.name}</div>
 <div className="text-xs text-muted-foreground">{r.user.studentId}</div>
 </div>
 </div>
 </td>
 <td className="p-3 hidden md:table-cell">
 <div className="text-sm truncate max-w-[200px]">{r.event?.title}</div>
 <div className="text-xs text-muted-foreground truncate">{r.event?.club?.name}</div>
 </td>
 <td className="p-3 hidden lg:table-cell text-sm text-muted-foreground">
 {formatDateTime(r.event?.startTime || r.createdAt)}
 </td>
 <td className="p-3">
 <Badge style={{ backgroundColor: statusColor(r.status) + '20', color: statusColor(r.status) }} className="text-xs">
 {statusEmoji(r.status)} {statusLabel(r.status)}
 </Badge>
 </td>
 <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground">
 {r.method ? CHECKIN_METHODS.find(m => m.value === r.method)?.label || r.method : '-'}
 </td>
 <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground">
 {r.checkInTime ? formatTime(r.checkInTime) : '-'}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </CardContent>
 </Card>
 )
}
