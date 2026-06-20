'use client'

import { useState, useEffect } from 'react'
import { useFetch, apiPatch } from '@/lib/clubhub/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, CheckCheck, Trash2, Megaphone, Calendar, CheckSquare, Vote, Heart, Trophy, Package, Building2, Brain, Mail } from 'lucide-react'
import { timeAgo } from '@/lib/clubhub/types'
import { toast } from 'sonner'

// Demo user — in production this would come from auth
const DEMO_USER_ID = 'demo-user-1'

const ICON_MAP: Record<string, any> = {
 announcement: Megaphone,
 event_reminder: Calendar,
 task_assigned: CheckSquare,
 rsvp_update: Calendar,
 poll_open: Vote,
 volunteer_hours: Heart,
 badge_earned: Trophy,
 application: Mail,
 inventory: Package,
 resource: Building2,
 insight: Brain,
}

const PRIORITY_COLORS: Record<string, string> = {
 low: 'text-muted-foreground',
 normal: 'text-foreground',
 high: 'text-foreground',
 urgent: 'text-foreground',
}

export function NotificationsBell({ onNavigate }: { onNavigate?: (link: string) => void }) {
 const { data, refetch } = useFetch<{ notifications: any[], unreadCount: number }>(`/api/notifications?userId=${DEMO_USER_ID}`)
 const [open, setOpen] = useState(false)

 const notifications = data?.notifications || []
 const unread = data?.unreadCount || 0

 const markAllRead = async () => {
 await apiPatch('/api/notifications', { markAllRead: true, userId: DEMO_USER_ID })
 refetch()
 }

 const markRead = async (id: string, link?: string | null) => {
 await apiPatch('/api/notifications', { id })
 refetch()
 if (link && onNavigate) onNavigate(link)
 setOpen(false)
 }

 return (
 <Popover open={open} onOpenChange={setOpen}>
 <PopoverTrigger asChild>
 <Button variant="ghost" size="icon" className="relative">
 <Bell className="h-4 w-4" />
 {unread > 0 && (
 <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-foreground text-white text-[10px] font-bold flex items-center justify-center px-1">
 {unread > 9 ? '9+' : unread}
 </span>
 )}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-80 p-0" align="end">
 <div className="flex items-center justify-between p-3 border-b">
 <div className="font-semibold text-sm flex items-center gap-2">
 <Bell className="h-4 w-4" />
 Notifications
 {unread > 0 && <Badge className="text-[10px]">{unread} new</Badge>}
 </div>
 {unread > 0 && (
 <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead}>
 <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
 </Button>
 )}
 </div>
 <ScrollArea className="h-96">
 {notifications.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-12">
 <Bell className="h-10 w-10 mx-auto mb-2 opacity-20" />
 No notifications yet
 </div>
 ) : (
 <div className="divide-y">
 {notifications.map((n: any) => {
 const Icon = ICON_MAP[n.type] || Bell
 return (
 <div
 key={n.id}
 className={`p-3 hover:bg-accent/30 cursor-pointer ${!n.isRead ? 'bg-primary/5' : ''}`}
 onClick={() => markRead(n.id, n.link)}
 >
 <div className="flex items-start gap-2">
 <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${!n.isRead ? 'bg-primary/10' : 'bg-muted'}`}>
 <Icon className={`h-3.5 w-3.5 ${PRIORITY_COLORS[n.priority] || ''}`} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-sm font-medium leading-tight">{n.title}</div>
 {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
 <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</div>
 </div>
 {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />}
 </div>
 </div>
 )
 })}
 </div>
 )}
 </ScrollArea>
 </PopoverContent>
 </Popover>
 )
}
