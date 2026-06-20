// Module registry — single source of truth for what modules exist,
// what they're called, how they're grouped, and which are always on.
//
// A "module" is a unit of functionality that a club can enable or disable.
// Each module ID corresponds to:
//   - a tab in /app (see src/app/app/page.tsx NAV_ITEMS)
//   - one or more API routes (gated by withModuleGate)
//   - one or more schema tables (not enforced — just convention)
//
// Design principles:
// - Always-on modules (dashboard, settings, clubs) are NOT in MODULES —
//   they're shell infrastructure, not opt-in functionality.
// - Core 3 (members, attendance, events) are the default for new clubs.
//   They're the literal definition of a club: who's in it, when it meets,
//   who showed up. Everything else is opt-in.
// - The 'goodFor' hint is shown in the onboarding picker and settings
//   toggle UI to help users decide without reading docs.

export type ModuleId =
  // Core 3
  | 'members' | 'attendance' | 'events'
  // Communication
  | 'announcements' | 'messages' | 'digests'
  // Money & time
  | 'finance' | 'volunteer'
  // Engagement
  | 'gamification' | 'photos' | 'polls' | 'forms' | 'tasks'
  // Operations
  | 'inventory' | 'maintenance' | 'resources' | 'meeting-minutes'
  // Membership lifecycle
  | 'applications' | 'invites' | 'offboarding' | 'alumni'
  // Reporting
  | 'analytics' | 'reports' | 'documents' | 'audit'
  // Power user
  | 'integrations' | 'bulk-import' | 'insights'
  // Attendance extras (parent / kiosk flow)
  | 'excuses' | 'reminders'

export type ModuleGroup =
  | 'Core' | 'Communication' | 'Money & time' | 'Engagement'
  | 'Operations' | 'Lifecycle' | 'Reporting' | 'Power user' | 'Attendance extras'

export interface ModuleDef {
  id: ModuleId
  label: string
  description: string
  goodFor: string
  group: ModuleGroup
}

export const MODULES: ModuleDef[] = [
  // ─── Core ───
  { id: 'members',    label: 'Members',     description: 'Roster, roles, custom fields',         goodFor: 'Every club. This is the literal definition of a club.',          group: 'Core' },
  { id: 'attendance', label: 'Attendance',  description: 'Manual roll and check-in',             goodFor: 'Every club that meets in person.',                              group: 'Core' },
  { id: 'events',     label: 'Events',      description: 'Schedule meetings and events',         goodFor: 'Every club. You need to know when the next meeting is.',        group: 'Core' },

  // ─── Communication ───
  { id: 'announcements', label: 'Announcements', description: 'Send updates to members',         goodFor: 'Clubs that don\'t already use Instagram or a group chat.',      group: 'Communication' },
  { id: 'messages',      label: 'Messages',      description: 'In-app DMs between members',      goodFor: 'Clubs that want private comms without leaving the app.',        group: 'Communication' },
  { id: 'digests',       label: 'Email digests', description: 'Scheduled weekly summaries',      goodFor: 'Clubs whose members want a single weekly recap email.',        group: 'Communication' },

  // ─── Money & time ───
  { id: 'finance',  label: 'Finance',        description: 'Dues, expenses, balances',          goodFor: 'Clubs that collect dues or spend money.',                      group: 'Money & time' },
  { id: 'volunteer', label: 'Volunteer hours', description: 'Service hours submitted and approved', goodFor: 'Service clubs (NHS, Key Club, etc.) that log service hours.', group: 'Money & time' },

  // ─── Engagement ───
  { id: 'gamification', label: 'Gamification',   description: 'Points, streaks, badges',       goodFor: 'Clubs struggling with attendance or engagement.',              group: 'Engagement' },
  { id: 'photos',       label: 'Photo albums',   description: 'Event photo galleries',         goodFor: 'Social clubs, yearbook-adjacent clubs, clubs that document.',  group: 'Engagement' },
  { id: 'polls',        label: 'Polls & elections', description: 'Live voting, anonymous or signed', goodFor: 'Clubs that vote on decisions or elect officers.',           group: 'Engagement' },
  { id: 'forms',        label: 'Forms & surveys', description: 'Custom form builder',           goodFor: 'Clubs that collect waivers, feedback, or signatures.',         group: 'Engagement' },
  { id: 'tasks',        label: 'Tasks',           description: 'Exec to-do list and deadlines', goodFor: 'Clubs with a real exec team that shares work.',                group: 'Engagement' },

  // ─── Operations ───
  { id: 'inventory',       label: 'Inventory',       description: 'Equipment and loans',         goodFor: 'Robotics, theater, art — clubs with physical stuff.',          group: 'Operations' },
  { id: 'maintenance',     label: 'Maintenance',     description: 'Repairs and inspections',     goodFor: 'Clubs with equipment that breaks (robotics, maker, AV).',      group: 'Operations' },
  { id: 'resources',       label: 'Resources',       description: 'Book rooms and gear',         goodFor: 'Clubs that share rooms, instruments, or equipment.',           group: 'Operations' },
  { id: 'meeting-minutes', label: 'Meeting minutes', description: 'Agendas and notes per meeting', goodFor: 'Secretary-heavy clubs, clubs that need a paper trail.',      group: 'Operations' },

  // ─── Lifecycle ───
  { id: 'applications', label: 'Applications', description: 'People who want to join',         goodFor: 'Selective clubs with an application process.',                 group: 'Lifecycle' },
  { id: 'invites',       label: 'Invites',      description: 'Email-based invitations',         goodFor: 'Clubs that recruit by email rather than open signup.',         group: 'Lifecycle' },
  { id: 'offboarding',   label: 'Offboarding',  description: 'Graduate or transition members out', goodFor: 'Clubs with a formal handoff process at year end.',         group: 'Lifecycle' },
  { id: 'alumni',        label: 'Alumni',       description: 'Graduated members, kept in touch', goodFor: 'Clubs that maintain an alumni network for fundraising or mentorship.', group: 'Lifecycle' },

  // ─── Reporting ───
  { id: 'analytics', label: 'Analytics', description: 'In-house charts and trends',           goodFor: 'Clubs that want to see attendance patterns over time.',        group: 'Reporting' },
  { id: 'reports',   label: 'Reports',   description: 'PDF exports and letters',              goodFor: 'Clubs that report up to a principal, admin, or board.',        group: 'Reporting' },
  { id: 'documents', label: 'Documents', description: 'File library with access control',     goodFor: 'Clubs with shared files (bylaws, contracts, reference docs).', group: 'Reporting' },
  { id: 'audit',     label: 'Audit log', description: 'Every action, recorded',               goodFor: 'Schools that require compliance tracking; usually advisor-on.', group: 'Reporting' },

  // ─── Power user ───
  { id: 'integrations', label: 'Integrations', description: 'Webhooks, API keys, email',       goodFor: 'Clubs that integrate Roster with other tools (Slack, Zapier).', group: 'Power user' },
  { id: 'bulk-import',  label: 'Bulk import',  description: 'CSV import for any entity',       goodFor: 'Clubs migrating from a spreadsheet mid-year.',                 group: 'Power user' },
  { id: 'insights',     label: 'Assistant',    description: 'Ask a question about your club data', goodFor: 'Power users who want a Q&A interface to their own data.',   group: 'Power user' },

  // ─── Attendance extras ───
  { id: 'excuses',  label: 'Absence excuses', description: 'Review parent- and student-submitted excuses', goodFor: 'Clubs that take attendance seriously enough to require excuses.', group: 'Attendance extras' },
  { id: 'reminders', label: 'Reminders',      description: 'Pre-meeting and day-of nudges',     goodFor: 'Clubs with low attendance that want automated nudges.',        group: 'Attendance extras' },
]

// The default set for a new club. Per the user's directive: "pick what
// features you need situation not 'everything is enabled by default'."
// Core 3 = the literal definition of a club.
export const CORE_MODULES: ModuleId[] = ['members', 'attendance', 'events']

// Tabs that are always shown regardless of modules config — they're shell
// infrastructure, not opt-in functionality.
export const ALWAYS_ON_TABS: string[] = ['dashboard', 'clubs', 'settings']

// Tabs that map 1:1 to a module ID. Used to filter the sidebar.
// The 'announcements' tab ID is a legacy alias for the CommunicationsTab
// component — the underlying module is 'announcements'.
export const TAB_TO_MODULE: Record<string, ModuleId> = Object.fromEntries(
  MODULES.map((m) => [m.id, m.id])
)

// Helper: parse the JSON string from Club.modules into a ModuleId[].
// Returns null if the club has no modules config (legacy clubs = all on).
export function parseModules(raw: string | null | undefined): ModuleId[] | null {
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return null
    return arr.filter((x): x is ModuleId => typeof x === 'string')
  } catch {
    return null
  }
}

// Helper: is a given module enabled for this club?
// null modules = legacy club = all on (backward compat).
export function isModuleEnabled(raw: string | null | undefined, moduleId: ModuleId): boolean {
  const list = parseModules(raw)
  if (list === null) return true
  return list.includes(moduleId)
}

// Helper: get the list of module IDs to show in the sidebar for a club.
// Always-on tabs + enabled modules. Returns null for "all on" (legacy).
export function getEnabledModuleIds(raw: string | null | undefined): ModuleId[] | null {
  return parseModules(raw)
}

// Helper: get the ModuleDef objects for a club's enabled modules.
// For legacy clubs (null), returns ALL modules.
export function getEnabledModules(raw: string | null | undefined): ModuleDef[] {
  const list = parseModules(raw)
  if (list === null) return MODULES
  return MODULES.filter((m) => list.includes(m.id))
}

// Helper: get a ModuleDef by ID.
export function getModuleDef(id: ModuleId): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id)
}

// Helper: get modules grouped for display (picker, settings toggle).
export function getModulesByGroup(): Record<ModuleGroup, ModuleDef[]> {
  const groups: Record<ModuleGroup, ModuleDef[]> = {
    'Core': [],
    'Communication': [],
    'Money & time': [],
    'Engagement': [],
    'Operations': [],
    'Lifecycle': [],
    'Reporting': [],
    'Power user': [],
    'Attendance extras': [],
  }
  for (const m of MODULES) {
    groups[m.group].push(m)
  }
  return groups
}
