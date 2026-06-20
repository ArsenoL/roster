'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCurrentClub, useFetch } from '@/lib/clubhub/hooks'
import { useAuth } from '@/lib/clubhub/use-auth'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LayoutDashboard, Users, CalendarDays, CalendarCheck, BarChart3, Trophy,
  Megaphone, Settings, History, Menu, School,
  DollarSign, Heart, Vote, ClipboardList, CheckSquare, Building2, Package,
  GraduationCap, UserPlus, FileText, MessageSquare,
  Webhook, Wrench, Mail, UploadCloud, Image as ImageIcon,
  CalendarClock, ShieldAlert, QrCode, Loader2, Moon, Sun, Search,
  Bot, Sparkle,
} from 'lucide-react'
import { DashboardTab } from '@/components/clubhub/dashboard-tab'
import { ClubsTab } from '@/components/clubhub/clubs-tab'
import { MembersTab } from '@/components/clubhub/members-tab'
import { EventsTab } from '@/components/clubhub/events-tab'
import { AttendanceTab } from '@/components/clubhub/attendance-tab'
import { AnalyticsTab } from '@/components/clubhub/analytics-tab'
import { GamificationTab } from '@/components/clubhub/gamification-tab'
import { CommunicationsTab } from '@/components/clubhub/communications-tab'
import { SettingsTab } from '@/components/clubhub/settings-tab'
import { AuditTab } from '@/components/clubhub/audit-tab'
import { FinanceTab } from '@/components/clubhub/finance-tab'
import { VolunteerHoursTab } from '@/components/clubhub/volunteer-hours-tab'
import { PollsTab } from '@/components/clubhub/polls-tab'
import { FormsTab } from '@/components/clubhub/forms-tab'
import { TasksTab } from '@/components/clubhub/tasks-tab'
import { ResourcesTab } from '@/components/clubhub/resources-tab'
import { InventoryTab } from '@/components/clubhub/inventory-tab'
import { DocumentsTab } from '@/components/clubhub/documents-tab'
import { AiInsightsTab } from '@/components/clubhub/ai-insights-tab'
import { AlumniTab } from '@/components/clubhub/alumni-tab'
import { ApplicationsTab } from '@/components/clubhub/applications-tab'
import { ReportsTab } from '@/components/clubhub/reports-tab'
import { NotificationsBell } from '@/components/clubhub/notifications-bell'
import { IntegrationsTab } from '@/components/clubhub/integrations-tab'
import { MessagesTab } from '@/components/clubhub/messages-tab'
import { MeetingMinutesTab } from '@/components/clubhub/meeting-minutes-tab'
import { InvitesTab, OffboardingTab } from '@/components/clubhub/invites-tab'
import { MaintenanceTab } from '@/components/clubhub/maintenance-tab'
import { DigestsTab } from '@/components/clubhub/digests-tab'
import { BulkImportTab } from '@/components/clubhub/bulk-import-tab'
import { PhotoAlbumsTab } from '@/components/clubhub/photo-albums-tab'
import { AttendanceExcusesTab } from '@/components/clubhub/attendance-excuses-tab'
import { AttendanceRemindersTab } from '@/components/clubhub/attendance-reminders-tab'
import { UserMenu } from '@/components/clubhub/user-menu'
import { type Club } from '@/lib/clubhub/types'

type TabId =
  | 'dashboard' | 'clubs' | 'members' | 'events' | 'attendance' | 'analytics' | 'gamification'
  | 'communications' | 'settings' | 'audit' | 'finance' | 'volunteer' | 'polls' | 'forms'
  | 'tasks' | 'resources' | 'inventory' | 'documents' | 'insights' | 'alumni' | 'applications'
  | 'reports' | 'messages' | 'integrations' | 'meeting-minutes' | 'invites' | 'offboarding'
  | 'maintenance' | 'digests' | 'bulk-import' | 'photos' | 'excuses' | 'reminders'

interface NavItem {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  group: NavGroup
}

type NavGroup = 'Today' | 'Members' | 'Plan' | 'Track' | 'Engage' | 'Report' | 'Admin'

const NAV_GROUPS: NavGroup[] = ['Today', 'Members', 'Plan', 'Track', 'Engage', 'Report', 'Admin']

const NAV_ITEMS: NavItem[] = [
  // ─── Today: run today's meeting ───
  { id: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard, description: 'Overview of the day and the week',  group: 'Today' },
  { id: 'attendance',    label: 'Take attendance',icon: CalendarCheck,  description: 'Kiosk check-in and manual roll',    group: 'Today' },
  { id: 'excuses',       label: 'Absence excuses',icon: ShieldAlert,    description: 'Review parent- and student-submitted excuses', group: 'Today' },
  { id: 'reminders',     label: 'Reminders',      icon: CalendarClock,  description: 'Pre-meeting and day-of nudges',     group: 'Today' },
  { id: 'announcements', label: 'Announcements',  icon: Megaphone,      description: 'Send updates to members and parents', group: 'Today' } as any,
  { id: 'tasks',         label: 'Tasks',          icon: CheckSquare,    description: 'Exec to-do list and deadlines',  group: 'Today' },
  { id: 'insights',      label: 'Assistant',      icon: Bot,            description: 'Ask a question about your club data', group: 'Today' },

  // ─── Members: track a member ───
  { id: 'members',       label: 'Members',        icon: Users,          description: 'Roster, roles, custom fields',      group: 'Members' },
  { id: 'applications',  label: 'Applications',   icon: UserPlus,       description: 'People who want to join',           group: 'Members' },
  { id: 'invites',       label: 'Invites',        icon: UserPlus,       description: 'Email-based invitations',           group: 'Members' },
  { id: 'offboarding',   label: 'Offboarding',    icon: GraduationCap,  description: 'Graduate or transition members out',group: 'Members' },
  { id: 'alumni',        label: 'Alumni',         icon: GraduationCap,  description: 'Graduated members, kept in touch',  group: 'Members' },

  // ─── Plan: plan ahead ───
  { id: 'events',        label: 'Events',         icon: CalendarDays,   description: 'Schedule meetings and events',      group: 'Plan' },
  { id: 'meeting-minutes', label: 'Meeting minutes', icon: FileText,    description: 'Agendas and notes per meeting',     group: 'Plan' },
  { id: 'polls',         label: 'Polls & elections', icon: Vote,        description: 'Live voting, anonymous or signed',  group: 'Plan' },
  { id: 'resources',     label: 'Resources',      icon: Building2,     description: 'Book rooms and gear',               group: 'Plan' },

  // ─── Track: money & time ───
  { id: 'finance',       label: 'Finance',        icon: DollarSign,    description: 'Dues, expenses, balances',          group: 'Track' },
  { id: 'volunteer',     label: 'Volunteer hours',icon: Heart,         description: 'Service hours submitted and approved', group: 'Track' },
  { id: 'inventory',     label: 'Inventory',      icon: Package,       description: 'Equipment and loans',               group: 'Track' },
  { id: 'maintenance',   label: 'Maintenance',    icon: Wrench,        description: 'Repairs and inspections',           group: 'Track' },

  // ─── Engage: keep people involved ───
  { id: 'communications',label: 'Communications', icon: Megaphone,     description: 'Announcements and email sends',     group: 'Engage' },
  { id: 'messages',      label: 'Messages',       icon: MessageSquare, description: 'In-app DMs between members',        group: 'Engage' },
  { id: 'digests',       label: 'Email digests',  icon: Mail,          description: 'Scheduled weekly summaries',        group: 'Engage' },
  { id: 'gamification',  label: 'Gamification',   icon: Trophy,        description: 'Points, streaks, badges',           group: 'Engage' },
  { id: 'photos',        label: 'Photo albums',   icon: ImageIcon,     description: 'Event photo galleries',             group: 'Engage' },
  { id: 'forms',         label: 'Forms & surveys',icon: ClipboardList, description: 'Custom form builder',               group: 'Engage' },

  // ─── Report: report up ───
  { id: 'analytics',     label: 'Analytics',      icon: BarChart3,     description: 'In-house charts and trends',        group: 'Report' },
  { id: 'reports',       label: 'Reports',        icon: FileText,      description: 'PDF exports and letters',           group: 'Report' },
  { id: 'documents',     label: 'Documents',      icon: FileText,      description: 'File library with access control',  group: 'Report' },
  { id: 'audit',         label: 'Audit log',      icon: History,       description: 'Every action, recorded',            group: 'Report' },

  // ─── Admin: configure ───
  { id: 'clubs',         label: 'Clubs',          icon: School,        description: 'Manage multiple clubs',             group: 'Admin' },
  { id: 'settings',      label: 'Settings',       icon: Settings,      description: 'Club configuration and custom fields', group: 'Admin' },
  { id: 'integrations',  label: 'Integrations',   icon: Webhook,       description: 'Webhooks, API keys, email',         group: 'Admin' },
  { id: 'bulk-import',   label: 'Bulk import',    icon: UploadCloud,   description: 'CSV import for any entity',         group: 'Admin' },
]

// Map legacy 'announcements' tab id → the CommunicationsTab component for rendering.
// (The communications-tab already handles announcements + email; we expose it under
// both labels because taking attendance and posting the post-meeting recap are
// different jobs even though they share a data source.)

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [clubId, setClubId] = useCurrentClub()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [settingsClubId, setSettingsClubId] = useState<string | undefined>(undefined)
  const [dark, setDark] = useState(false)

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=/app')
    }
  }, [authLoading, user, router])

  // Sync active tab from URL ?tab=
  useEffect(() => {
    const tab = searchParams.get('tab') as TabId | null
    if (tab && NAV_ITEMS.some((n) => n.id === tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

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

  const { data: clubsData } = useFetch<{ clubs: Club[] }>('/api/clubs')
  const clubs = clubsData?.clubs || []

  const navigateToSettings = (id: string) => {
    setSettingsClubId(id)
    setClubId(id)
    setActiveTab('settings')
  }

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    if (tab !== 'settings') setSettingsClubId(undefined)
    setMobileNavOpen(false)
  }

  const currentNav = NAV_ITEMS.find((n) => n.id === activeTab)
  const currentClub = clubs.find((c) => c.id === clubId)

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <div className="mt-3 label-mono">Loading your workspace</div>
        </div>
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ───────────────── Top bar ─────────────────
          Civic: ruled border-b, no glass, no blur, no Sparkles logo. */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="flex h-14 items-center px-4 gap-3">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <Sidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                clubId={clubId}
                clubs={clubs}
                onClubChange={setClubId}
              />
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center gap-2" title="Back to home">
            <span className="text-base font-semibold tracking-tight">Roster</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {/* Club selector — civic, ruled, no decorative icon */}
            <Select value={clubId} onValueChange={setClubId}>
              <SelectTrigger className="w-[160px] md:w-[240px] h-9">
                <SelectValue placeholder="Select a club" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All clubs (overview)</SelectItem>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open('/kiosk', '_blank')}
              title="Open kiosk check-in"
            >
              <QrCode className="h-4 w-4" />
            </Button>

            {/* Command palette trigger */}
            <button
              onClick={() => {
                document.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: false, bubbles: true })
                )
              }}
              className="hidden md:flex items-center gap-2 h-9 px-2.5 text-xs text-muted-foreground border border-border hover:bg-muted transition-colors"
              title="Open command palette (⌘K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden lg:inline-flex items-center justify-center h-4 px-1 text-[10px] mono bg-background border border-border">
                ⌘K
              </kbd>
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              title="Toggle dark mode"
              className="hidden md:inline-flex"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <NotificationsBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-60 flex-col border-r border-border bg-background shrink-0">
          <Sidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            clubId={clubId}
            clubs={clubs}
            onClubChange={setClubId}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-5 md:p-8">
            {/* Tab header — civic: ruled border-b, no badge pills */}
            <div className="mb-6 pb-4 border-b border-border flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <div className="label-mono mb-1">{currentNav?.group}</div>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                  {currentNav?.label}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentNav?.description}
                  {clubId !== 'ALL' && activeTab !== 'clubs' && currentClub && (
                    <>
                      {' '}· <span className="text-foreground">{currentClub.name}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'dashboard' && <DashboardTab clubId={clubId} />}
            {activeTab === 'clubs' && <ClubsTab onNavigateToSettings={navigateToSettings} />}
            {activeTab === 'members' && <MembersTab clubId={clubId} />}
            {activeTab === 'events' && <EventsTab clubId={clubId} />}
            {activeTab === 'attendance' && <AttendanceTab clubId={clubId} />}
            {activeTab === 'analytics' && <AnalyticsTab clubId={clubId} />}
            {activeTab === 'gamification' && <GamificationTab clubId={clubId} />}
            {(activeTab === 'communications' || activeTab === ('announcements' as TabId)) && (
              <CommunicationsTab clubId={clubId} />
            )}
            {activeTab === 'settings' && <SettingsTab clubId={clubId} clubIdForced={settingsClubId} />}
            {activeTab === 'audit' && <AuditTab clubId={clubId} />}
            {activeTab === 'finance' && <FinanceTab clubId={clubId} />}
            {activeTab === 'volunteer' && <VolunteerHoursTab clubId={clubId} />}
            {activeTab === 'polls' && <PollsTab clubId={clubId} />}
            {activeTab === 'forms' && <FormsTab clubId={clubId} />}
            {activeTab === 'tasks' && <TasksTab clubId={clubId} />}
            {activeTab === 'resources' && <ResourcesTab clubId={clubId} />}
            {activeTab === 'inventory' && <InventoryTab clubId={clubId} />}
            {activeTab === 'documents' && <DocumentsTab clubId={clubId} />}
            {activeTab === 'insights' && <AiInsightsTab clubId={clubId} />}
            {activeTab === 'alumni' && <AlumniTab clubId={clubId} />}
            {activeTab === 'applications' && <ApplicationsTab clubId={clubId} />}
            {activeTab === 'reports' && <ReportsTab clubId={clubId} />}
            {activeTab === 'messages' && <MessagesTab clubId={clubId} />}
            {activeTab === 'meeting-minutes' && <MeetingMinutesTab clubId={clubId} />}
            {activeTab === 'invites' && <InvitesTab clubId={clubId} />}
            {activeTab === 'offboarding' && <OffboardingTab clubId={clubId} />}
            {activeTab === 'maintenance' && <MaintenanceTab clubId={clubId} />}
            {activeTab === 'digests' && <DigestsTab clubId={clubId} />}
            {activeTab === 'integrations' && <IntegrationsTab clubId={clubId} />}
            {activeTab === 'bulk-import' && <BulkImportTab clubId={clubId} />}
            {activeTab === 'photos' && <PhotoAlbumsTab clubId={clubId} />}
            {activeTab === 'excuses' && <AttendanceExcusesTab clubId={clubId} />}
            {activeTab === 'reminders' && <AttendanceRemindersTab clubId={clubId} />}
          </div>

          {/* Footer — civic, no "33 modules" brag */}
          <footer className="border-t border-border py-4 px-5 md:px-8">
            <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2 label-mono">
              <div className="flex items-center gap-3">
                <span>Roster</span>
                <Link href="/" className="hover:text-foreground">Home</Link>
              </div>
              <div className="flex items-center gap-3">
                <span>{clubs.length} clubs</span>
                <span>·</span>
                <span>{clubs.reduce((sum, c) => sum + (c.activeMembers || 0), 0)} members</span>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

/* ───────────────────────── Sidebar ───────────────────────── */

function Sidebar({
  activeTab,
  onTabChange,
  clubId,
  clubs,
  onClubChange,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  clubId: string
  clubs: Club[]
  onClubChange: (id: string) => void
}) {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Club selector at top of sidebar (mobile + desktop) */}
      <div className="p-4 border-b border-border">
        <div className="label-mono mb-2">Club</div>
        <Select value={clubId} onValueChange={onClubChange}>
          <SelectTrigger className="w-full h-9">
            <span className="truncate">
              {clubId === 'ALL' ? 'All clubs (overview)' : (clubs.find((c) => c.id === clubId)?.name ?? 'Select')}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All clubs (overview)</SelectItem>
            {clubs.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-3 space-y-5">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((n) => n.group === group)
            if (!items.length) return null
            return (
              <div key={group}>
                <div className="label-mono px-2 mb-1.5">{group}</div>
                <div className="space-y-px">
                  {items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-foreground text-background font-medium'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate flex-1 text-left">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}
