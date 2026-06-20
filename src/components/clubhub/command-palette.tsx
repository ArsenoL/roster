'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
 CommandDialog, CommandEmpty, CommandGroup, CommandInput,
 CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from '@/components/ui/command'
import {
 LayoutDashboard, Users, CalendarDays, CalendarCheck, BarChart3, Trophy,
 Megaphone, Settings, History, School, DollarSign, Heart, Vote, ClipboardList,
 CheckSquare, Building2, Package, FolderOpen, GraduationCap, UserPlus, FileText,
 Brain, MessageSquare, Webhook, Wrench, Mail, UploadCloud, Image as ImageIcon,
 CalendarClock, ShieldAlert, QrCode, Home, Search, Moon, Sun, LogOut,
 Compass, Bell, LogIn,
} from 'lucide-react'
import { useAuth } from '@/lib/clubhub/use-auth'

interface CommandItemDef {
 label: string
 hint?: string
 icon: any
 action: () => void
 shortcut?: string
 group: string
 keywords?: string[]
}

export function CommandPalette() {
 const router = useRouter()
 const { user, logout } = useAuth()
 const [open, setOpen] = useState(false)
 const [dark, setDark] = useState(false)

 // Listen for Cmd+K (Mac) / Ctrl+K (Windows/Linux)
 useEffect(() => {
 const down = (e: KeyboardEvent) => {
 if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
 e.preventDefault()
 setOpen(o => !o)
 }
 }
 document.addEventListener('keydown', down)
 return () => document.removeEventListener('keydown', down)
 }, [])

 useEffect(() => {
 setDark(document.documentElement.classList.contains('dark'))
 }, [open])

 const toggleDark = () => {
 const next = !dark
 if (next) {
 document.documentElement.classList.add('dark')
 localStorage.setItem('roster.theme', 'dark')
 } else {
 document.documentElement.classList.remove('dark')
 localStorage.setItem('roster.theme', 'light')
 }
 }

 const navigate = (path: string) => {
 setOpen(false)
 router.push(path)
 }

 // Build the command list based on whether user is signed in + role
 const items: CommandItemDef[] = useMemo(() => {
 const items: CommandItemDef[] = []

 // Public navigation — always available
 items.push(
 { label: 'Home', icon: Home, action: () => navigate('/'), group: 'Public', shortcut: '⌘H' },
 { label: 'Discover clubs', hint: 'Browse the public club directory', icon: Compass, action: () => navigate('/discover'), group: 'Public' },
 { label: 'Kiosk check-in', hint: 'Open the self-service check-in kiosk', icon: QrCode, action: () => navigate('/kiosk'), group: 'Public' },
 { label: 'Sign in', icon: LogIn, action: () => navigate('/login'), group: 'Public' },
 )

 if (user) {
 // Role-aware dashboards
 items.push(
 {
 label: 'My dashboard',
 hint: 'Your personal home base',
 icon: Home,
 action: () => navigate(user.role === 'STUDENT' ? '/app/me' : user.role === 'PARENT' ? '/app/parent' : '/app'),
 group: 'Dashboard',
 shortcut: '⌘D',
 },
 )
 if (user.role === 'STUDENT') {
 items.push({ label: 'My clubs & attendance', icon: GraduationCap, action: () => navigate('/app/me'), group: 'Dashboard' })
 }
 if (user.role === 'PARENT') {
 items.push({ label: 'Parent portal', hint: 'View your children', icon: Heart, action: () => navigate('/app/parent'), group: 'Dashboard' })
 }
 if (user.role !== 'STUDENT' && user.role !== 'PARENT') {
 items.push({ label: 'Admin dashboard', hint: 'Run a club', icon: Building2, action: () => navigate('/app'), group: 'Dashboard' })
 }
 items.push({ label: 'Onboarding', hint: 'Set up a new club or join one', icon: UserPlus, action: () => navigate('/app/onboarding'), group: 'Dashboard' })

 // All admin app tabs (only for non-students / non-parents)
 if (user.role !== 'STUDENT' && user.role !== 'PARENT') {
 const tabNav: { label: string, icon: any, tab: string, keywords?: string[] }[] = [
 { label: 'Dashboard overview', icon: LayoutDashboard, tab: 'dashboard' },
 { label: 'Analytics', icon: BarChart3, tab: 'analytics', keywords: ['charts', 'stats', 'trends'] },
 { label: 'AI Insights', icon: Brain, tab: 'insights', keywords: ['llm', 'ai', 'recommendations'] },
 { label: 'Reports', icon: FileText, tab: 'reports', keywords: ['pdf', 'export'] },
 { label: 'Clubs', icon: School, tab: 'clubs' },
 { label: 'Members', icon: Users, tab: 'members' },
 { label: 'Invites', icon: UserPlus, tab: 'invites' },
 { label: 'Alumni', icon: GraduationCap, tab: 'alumni' },
 { label: 'Recruitment', icon: UserPlus, tab: 'applications' },
 { label: 'Offboarding', icon: GraduationCap, tab: 'offboarding' },
 { label: 'Events', icon: CalendarDays, tab: 'events' },
 { label: 'Attendance', icon: CalendarCheck, tab: 'attendance' },
 { label: 'Absence excuses', icon: ShieldAlert, tab: 'excuses' },
 { label: 'Reminders', icon: CalendarClock, tab: 'reminders' },
 { label: 'Meeting minutes', icon: FileText, tab: 'meeting-minutes' },
 { label: 'Tasks', icon: CheckSquare, tab: 'tasks' },
 { label: 'Resources', icon: Building2, tab: 'resources' },
 { label: 'Inventory', icon: Package, tab: 'inventory' },
 { label: 'Maintenance', icon: Wrench, tab: 'maintenance' },
 { label: 'Gamification', icon: Trophy, tab: 'gamification', keywords: ['badges', 'points', 'streaks'] },
 { label: 'Polls & elections', icon: Vote, tab: 'polls' },
 { label: 'Forms & surveys', icon: ClipboardList, tab: 'forms' },
 { label: 'Announcements', icon: Megaphone, tab: 'communications' },
 { label: 'Messages', icon: MessageSquare, tab: 'messages' },
 { label: 'Photo albums', icon: ImageIcon, tab: 'photos' },
 { label: 'Finance', icon: DollarSign, tab: 'finance' },
 { label: 'Volunteer hours', icon: Heart, tab: 'volunteer' },
 { label: 'Documents', icon: FolderOpen, tab: 'documents' },
 { label: 'Email digests', icon: Mail, tab: 'digests' },
 { label: 'Integrations', icon: Webhook, tab: 'integrations' },
 { label: 'Bulk import', icon: UploadCloud, tab: 'bulk-import' },
 { label: 'Settings', icon: Settings, tab: 'settings' },
 { label: 'Audit log', icon: History, tab: 'audit' },
 ]
 tabNav.forEach(t => {
 items.push({
 label: t.label,
 icon: t.icon,
 action: () => navigate(`/app?tab=${t.tab}`),
 group: 'Modules',
 keywords: t.keywords,
 })
 })
 }

 // Quick actions
 items.push(
 { label: 'Toggle dark mode', icon: dark ? Sun : Moon, action: toggleDark, group: 'Quick actions' },
 { label: 'Sign out', icon: LogOut, action: async () => { await logout(); router.push('/') }, group: 'Quick actions' },
 )
 }

 return items
 }, [user, dark, logout, router])

 // Group items
 const groups = useMemo(() => {
 const map = new Map<string, CommandItemDef[]>()
 items.forEach(i => {
 if (!map.has(i.group)) map.set(i.group, [])
 map.get(i.group)!.push(i)
 })
 return Array.from(map.entries())
 }, [items])

 return (
 <CommandDialog open={open} onOpenChange={setOpen}>
 <CommandInput placeholder="Search clubs, modules, actions…" />
 <CommandList>
 <CommandEmpty>No results found.</CommandEmpty>
 {groups.map(([group, groupItems]) => (
 <CommandGroup key={group} heading={group}>
 {groupItems.map((item, idx) => {
 const Icon = item.icon
 return (
 <CommandItem
 key={`${group}-${idx}`}
 onSelect={() => item.action()}
 keywords={item.keywords}
 >
 <Icon className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="text-sm">{item.label}</div>
 {item.hint && <div className="text-xs text-muted-foreground truncate">{item.hint}</div>}
 </div>
 {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
 </CommandItem>
 )
 })}
 </CommandGroup>
 ))}
 </CommandList>
 </CommandDialog>
 )
}
