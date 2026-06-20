'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth, defaultLandingForUser } from '@/lib/clubhub/use-auth'
import {
 LogIn, LogOut, User as UserIcon, ChevronDown, Settings, School,
 Heart, GraduationCap, Building2, Moon, Sun, Home, Menu as MenuIcon,
} from 'lucide-react'
import { avatarColor, initials } from '@/lib/clubhub/types'

export function UserMenu() {
 const { user, loading, logout } = useAuth()
 const [open, setOpen] = useState(false)
 const [dark, setDark] = useState(false)
 const ref = useRef<HTMLDivElement>(null)
 const router = useRouter()

 useEffect(() => {
 setDark(document.documentElement.classList.contains('dark'))
 }, [])

 useEffect(() => {
 function onClick(e: MouseEvent) {
 if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
 }
 document.addEventListener('mousedown', onClick)
 return () => document.removeEventListener('mousedown', onClick)
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

 if (loading) {
 return <Avatar className="h-8 w-8 bg-muted animate-pulse" />
 }

 if (!user) {
 return (
 <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
 <LogIn className="h-3.5 w-3.5 mr-1" /> Sign in
 </Button>
 )
 }

 const roleLabel: Record<string, string> = {
 SUPER_ADMIN: 'Super Admin',
 SCHOOL_ADMIN: 'School Admin',
 ADVISOR: 'Advisor',
 CLUB_LEADER: 'Club Leader',
 STUDENT: 'Student',
 PARENT: 'Parent',
 GUEST: 'Guest',
 }
 const roleIcon: Record<string, any> = {
 SUPER_ADMIN: Building2,
 SCHOOL_ADMIN: Building2,
 ADVISOR: School,
 CLUB_LEADER: GraduationCap,
 STUDENT: GraduationCap,
 PARENT: Heart,
 GUEST: UserIcon,
 }
 const RoleIcon = roleIcon[user.role] || UserIcon

 // Where this user lands by default
 const homeHref = defaultLandingForUser(user)

 return (
 <div className="relative" ref={ref}>
 <button
 onClick={() => setOpen(!open)}
 className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors"
 >
 <Avatar className="h-8 w-8" style={{ backgroundColor: avatarColor(user.name) }}>
 <AvatarFallback className="text-white text-xs font-medium">
 {initials(user.name)}
 </AvatarFallback>
 </Avatar>
 <div className="hidden md:block text-left">
 <div className="text-xs font-medium leading-none">{user.name}</div>
 <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{roleLabel[user.role] || user.role}</div>
 </div>
 <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
 </button>

 {open && (
 <div className="absolute right-0 mt-2 w-64 bg-background border rounded-lg z-50 overflow-hidden fade-in">
 <div className="p-3 border-b bg-muted/30">
 <div className="flex items-center gap-2">
 <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-soft text-brand-ink shrink-0">
 <RoleIcon className="h-4 w-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="font-medium text-sm truncate">{user.name}</div>
 <div className="text-xs text-muted-foreground truncate">{user.email}</div>
 </div>
 </div>
 <div className="mt-2 flex items-center gap-1.5">
 <Badge variant="outline" className="text-[10px]">{roleLabel[user.role] || user.role}</Badge>
 {user.memberships && user.memberships.length > 0 && (
 <Badge variant="outline" className="text-[10px]">{user.memberships.length} clubs</Badge>
 )}
 </div>
 </div>

 {/* Switch dashboard view (role-aware) */}
 <div className="p-1 border-b">
 <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">Switch view</div>
 <Link
 href={homeHref}
 onClick={() => setOpen(false)}
 className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 <Home className="h-3.5 w-3.5" /> My dashboard
 </Link>
 {user.role !== 'STUDENT' && user.role !== 'PARENT' && (
 <Link
 href="/app"
 onClick={() => setOpen(false)}
 className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 <Building2 className="h-3.5 w-3.5" /> Admin dashboard
 </Link>
 )}
 {user.role === 'PARENT' && (
 <Link
 href="/app/parent"
 onClick={() => setOpen(false)}
 className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 <Heart className="h-3.5 w-3.5" /> Parent portal
 </Link>
 )}
 {user.role === 'STUDENT' && (
 <Link
 href="/app/me"
 onClick={() => setOpen(false)}
 className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 <GraduationCap className="h-3.5 w-3.5" /> My clubs
 </Link>
 )}
 <Link
 href="/discover"
 onClick={() => setOpen(false)}
 className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 <School className="h-3.5 w-3.5" /> Discover clubs
 </Link>
 </div>

 {/* Club memberships */}
 {user.memberships && user.memberships.length > 0 && (
 <div className="p-1 border-b">
 <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">Your Clubs</div>
 {user.memberships.slice(0, 4).map((m) => (
 <Link
 key={m.clubId}
 href={`/portal/${m.clubId}`}
 onClick={() => setOpen(false)}
 className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 <School className="h-3 w-3 text-muted-foreground" />
 <span className="flex-1 truncate">{m.clubName}</span>
 <Badge variant="outline" className="text-[9px]">{m.role.replace(/_/g, ' ')}</Badge>
 </Link>
 ))}
 {user.memberships.length > 4 && (
 <div className="px-2 py-1 text-[10px] text-muted-foreground">+{user.memberships.length - 4} more</div>
 )}
 </div>
 )}

 {/* Footer actions */}
 <div className="p-1">
 <button
 onClick={toggleDark}
 className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
 {dark ? 'Light mode' : 'Dark mode'}
 </button>
 <Link
 href="/"
 onClick={() => setOpen(false)}
 className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded"
 >
 <Home className="h-3.5 w-3.5" /> Back to landing
 </Link>
 <button
 onClick={async () => { await logout(); setOpen(false); router.push('/') }}
 className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded text-foreground"
 >
 <LogOut className="h-3.5 w-3.5" /> Sign out
 </button>
 </div>
 </div>
 )}
 </div>
 )
}
