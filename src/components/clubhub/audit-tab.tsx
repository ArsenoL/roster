'use client'

import { useState } from 'react'
import { useFetch } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { History, Search, Filter, Download, ChevronDown, ChevronRight, User, Clock, FileEdit } from 'lucide-react'
import { avatarColor, initials, formatDateTime } from '@/lib/clubhub/types'

const ENTITY_OPTIONS = [
 { value: 'ALL', label: 'All Entities' },
 { value: 'Club', label: 'Clubs' },
 { value: 'User', label: 'Users' },
 { value: 'Membership', label: 'Memberships' },
 { value: 'Event', label: 'Events' },
 { value: 'Attendance', label: 'Attendance' },
 { value: 'Badge', label: 'Badges' },
 { value: 'Announcement', label: 'Announcements' },
 { value: 'CustomField', label: 'Custom Fields' },
 { value: 'ClubSetting', label: 'Settings' },
]

const ACTION_COLORS: Record<string, string> = {
 create: '#10b981',
 update: '#f59e0b',
 delete: '#ef4444',
 award: '#8b5cf6',
 export: '#06b6d4',
 bulk_import: '#6366f1',
 login: '#3b82f6',
}

export function AuditTab({ clubId }: { clubId: string }) {
 const [entity, setEntity] = useState('ALL')
 const [action, setAction] = useState('ALL')
 const [search, setSearch] = useState('')
 const [expanded, setExpanded] = useState<Set<string>>(new Set())

 const url = `/api/audit?${clubId !== 'ALL' ? `clubId=${clubId}&` : ''}entity=${entity}&action=${action}&limit=200`
 const { data, loading } = useFetch<{ logs: any[] }>(url)

 const logs = (data?.logs || []).filter(l =>
 !search || l.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
 l.action.toLowerCase().includes(search.toLowerCase()) ||
 l.entity.toLowerCase().includes(search.toLowerCase())
 )

 const toggleExpand = (id: string) => {
 const next = new Set(expanded)
 if (next.has(id)) next.delete(id)
 else next.add(id)
 setExpanded(next)
 }

 const exportLogs = () => {
 const csv = [
 'Timestamp,User,Action,Entity,EntityId,ClubId',
 ...logs.map(l => `${l.timestamp},${l.user?.name || 'System'},${l.action},${l.entity},${l.entityId || ''},${l.clubId || ''}`)
 ].join('\n')
 const blob = new Blob([csv], { type: 'text/csv' })
 const url = URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
 a.click()
 }

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Audit Log</CardTitle>
 <CardDescription>Complete activity history. Every change is tracked for accountability.</CardDescription>
 </div>
 <Button variant="outline" size="sm" onClick={exportLogs}><Download className="h-3.5 w-3.5" /> Export</Button>
 </div>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex flex-wrap items-center gap-3">
 <div className="relative flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, action, or entity..." className="pl-9" />
 </div>
 <Select value={entity} onValueChange={setEntity}>
 <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 {ENTITY_OPTIONS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
 </SelectContent>
 </Select>
 <Select value={action} onValueChange={setAction}>
 <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Actions</SelectItem>
 <SelectItem value="create">Create</SelectItem>
 <SelectItem value="update">Update</SelectItem>
 <SelectItem value="delete">Delete</SelectItem>
 <SelectItem value="award">Award</SelectItem>
 <SelectItem value="export">Export</SelectItem>
 <SelectItem value="bulk_import">Bulk Import</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {loading ? (
 <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
 ) : logs.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">
 <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No log entries found
 </div>
 ) : (
 <ScrollArea className="h-[600px]">
 <div className="space-y-1">
 {logs.map(log => {
 const isExpanded = expanded.has(log.id)
 return (
 <div key={log.id} className="rounded-lg border hover:bg-accent/30">
 <button
 onClick={() => toggleExpand(log.id)}
 className="w-full flex items-center gap-3 p-3 text-left"
 >
 {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
 <Avatar className="h-8 w-8 shrink-0" style={{ backgroundColor: avatarColor(log.user?.name || 'System') }}>
 <AvatarFallback className="text-white text-[10px]">
 {log.user ? initials(log.user.name) : <User className="h-3 w-3" />}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium">{log.user?.name || 'System'}</span>
 <Badge
 variant="outline"
 className="text-[10px]"
 style={{
 backgroundColor: (ACTION_COLORS[log.action] || '#6b7280') + '20',
 color: ACTION_COLORS[log.action] || '#6b7280'
 }}
 >
 {log.action.replace(/_/g, ' ')}
 </Badge>
 <Badge variant="secondary" className="text-[10px]">{log.entity}</Badge>
 </div>
 <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
 <Clock className="h-2.5 w-2.5" />
 {formatDateTime(log.timestamp)}
 {log.entityId && <span>· ID: {log.entityId.slice(-8)}</span>}
 </div>
 </div>
 </button>
 {isExpanded && (log.before || log.after) && (
 <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
 {log.before && (
 <div>
 <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
 <FileEdit className="h-3 w-3" /> Before
 </div>
 <pre className="text-xs bg-muted/50 p-2 rounded max-h-40 overflow-auto">
 {(() => { try { return JSON.stringify(JSON.parse(log.before), null, 2) } catch { return log.before } })()}
 </pre>
 </div>
 )}
 {log.after && (
 <div>
 <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
 <FileEdit className="h-3 w-3" /> After
 </div>
 <pre className="text-xs bg-muted/50 p-2 rounded max-h-40 overflow-auto">
 {(() => { try { return JSON.stringify(JSON.parse(log.after), null, 2) } catch { return log.after } })()}
 </pre>
 </div>
 )}
 </div>
 )}
 </div>
 )
 })}
 </div>
 </ScrollArea>
 )}
 </CardContent>
 </Card>
 </div>
 )
}
