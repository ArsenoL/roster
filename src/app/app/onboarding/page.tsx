'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiPost } from '@/lib/clubhub/hooks'
import { useAuth } from '@/lib/clubhub/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, ArrowRight, Plus, Search, Heart, Eye, Sun, Moon, Check } from 'lucide-react'
import { CLUB_CATEGORIES, categoryLabel } from '@/lib/clubhub/types'
import { MODULES, CORE_MODULES, getModulesByGroup, type ModuleId, type ModuleGroup } from '@/lib/clubhub/modules'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading, refresh } = useAuth()
  const [dark, setDark] = useState(false)
  const [mode, setMode] = useState<'choose' | 'create'>('choose')

  // Club-create form state (only used when mode === 'create')
  const [clubName, setClubName] = useState('')
  const [clubCategory, setClubCategory] = useState<string>('ACADEMIC')
  // Modules: starts with Core 3 pre-checked. The picker shows all modules
  // grouped by category; the user can toggle anything on or off (except
  // the Core 3, which are locked on — they're the literal definition of
  // a club).
  const [selectedModules, setSelectedModules] = useState<Set<ModuleId>>(
    new Set(CORE_MODULES)
  )
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  // Auth gate — if not signed in, redirect to login with the next param preserved.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?next=/app/onboarding')
    }
  }, [authLoading, user, router])

  // If user is already in a club, skip onboarding entirely.
  useEffect(() => {
    if (user && user.memberships && user.memberships.length > 0) {
      router.replace('/app')
    }
  }, [user, router])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!user) return null

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

  async function createClub() {
    if (!clubName.trim()) {
      toast.error('Give your club a name first.')
      return
    }
    setCreating(true)
    try {
      const res = await apiPost('/api/clubs', {
        name: clubName.trim(),
        category: clubCategory,
        // Pass the user's selected modules. The server defaults to Core 3
        // if this is omitted, but we always send it so the user's choices
        // are honored exactly.
        modules: Array.from(selectedModules),
        // Everything else is deferred to in-product Settings.
        description: null,
        isPublic: true,
        requireApproval: false,
      })
      const clubId = res?.club?.id || res?.id
      if (clubId) {
        toast.success('Club created. Taking you to your dashboard.')
        // Re-fetch the user so the new membership + upgraded role are
        // reflected before we land on /app — otherwise the onboarding
        // gate on /app would bounce them back here.
        await refresh()
        setTimeout(() => router.push('/app'), 400)
      } else {
        toast.error('Could not create the club. ' + (res?.error ?? ''))
        setCreating(false)
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not create the club.')
      setCreating(false)
    }
  }

  const toggleModule = (id: ModuleId) => {
    // Core 3 can't be unchecked — they ARE the club.
    if (CORE_MODULES.includes(id)) return
    setSelectedModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — civic */}
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              welcome, {user.name.split(' ')[0]}
            </span>
          </Link>
          <Button variant="ghost" size="sm" onClick={toggleDark} aria-label="Toggle dark mode">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-12 md:py-16">
        {/* Heading */}
        <div className="mb-10">
          <div className="ribbon mb-4" />
          <div className="label-mono mb-2">Welcome</div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            What do you want to do?
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl leading-relaxed">
            You can change your mind later. Roster doesn&apos;t lock you into a role — it just picks
            the first screen to show you.
          </p>
        </div>

        {mode === 'choose' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
            <ChoiceCard
              icon={Plus}
              label="Create a new club"
              body="You run this club (or want to). Pick a name and a category; everything else is set later in Settings."
              cta="Start a club"
              onClick={() => setMode('create')}
              accent="coral"
            />
            <ChoiceCard
              icon={Search}
              label="Join an existing club"
              body="Browse the public clubs at your school and apply to the ones you want to be part of."
              cta="Browse clubs"
              href="/discover"
              accent="teal"
            />
            <ChoiceCard
              icon={Heart}
              label="I'm a parent or guardian"
              body="You're here to check on your kid's club activity. You'll need a token from them or their advisor."
              cta="Open parent view"
              href="/app/parent"
              accent="amber"
            />
            <ChoiceCard
              icon={Eye}
              label="Just looking"
              body="Want to poke around before committing? Open the demo club — no signup, no commitment."
              cta="Try a demo"
              href="/demo"
              accent="violet"
            />
          </div>
        )}

        {mode === 'create' && (
          <div className="border border-border">
            <div className="p-6 md:p-8 border-b border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className="ribbon" />
                <div className="label-mono">Step 1 of 1</div>
              </div>
              <h2 className="text-xl font-semibold mb-1">Name your club</h2>
              <p className="text-sm text-muted-foreground">
                That&apos;s all you need to get started. You can set the description, meeting day,
                dues, room, branding, and custom fields from Settings once you&apos;re inside.
              </p>
            </div>

            <div className="p-6 md:p-8 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="clubName" className="label-mono">
                  Club name
                </Label>
                <Input
                  id="clubName"
                  placeholder="e.g. Robotics & Engineering Society"
                  className="h-11 field"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createClub()}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clubCategory" className="label-mono">
                  Category
                </Label>
                <Select value={clubCategory} onValueChange={setClubCategory}>
                  <SelectTrigger id="clubCategory" className="h-11 field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLUB_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.emoji} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ─── Module picker ───
                  Firebase-style: pick what you need. Core 3 are locked on
                  (a club has members, meets, and tracks who showed up —
                  by definition). Everything else is opt-in. */}

              <div className="space-y-2.5 pt-2">
                <Label className="label-mono">Modules</Label>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Pick what this club actually needs. You can add or remove modules from
                  Settings → Modules anytime. The three core modules are always on.
                </p>

                <div className="space-y-5 pt-3">
                  {Object.entries(getModulesByGroup()).map(([group, mods]) => {
                    if (!mods.length) return null
                    return (
                      <div key={group}>
                        <div className="label-mono text-xs text-muted-foreground mb-2">{group}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border">
                          {mods.map((m) => {
                            const checked = selectedModules.has(m.id)
                            const locked = CORE_MODULES.includes(m.id)
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => toggleModule(m.id)}
                                disabled={locked}
                                className={`text-left p-3.5 bg-background transition-colors ${
                                  locked ? 'cursor-default' : 'hover:bg-muted/50'
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <div className={`mt-0.5 h-4 w-4 border flex items-center justify-center shrink-0 ${
                                    checked ? 'bg-foreground border-foreground' : 'border-border'
                                  }`}>
                                    {checked && <Check className="h-3 w-3 text-background" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-sm font-medium">{m.label}</span>
                                      {locked && (
                                        <span className="text-[10px] label-mono text-muted-foreground">always on</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                                    <div className="text-[11px] text-muted-foreground/80 mt-1 italic">{m.goodFor}</div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => setMode('choose')}>
                  ← Back
                </Button>
                <Button onClick={createClub} disabled={!clubName.trim() || creating} className="h-11 px-5 btn-vibrant">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…
                    </>
                  ) : (
                    <>
                      Create club ({selectedModules.size} modules) <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer help line */}
        <div className="mt-10 pt-6 border-t border-border flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">
            Already in a club?{' '}
            <Link href="/app" className="text-foreground link-u">
              Go to your dashboard
            </Link>
          </span>
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}

/* ───── Sub-components ───── */

function ChoiceCard({
  icon: Icon,
  label,
  body,
  cta,
  href,
  onClick,
  accent = 'coral',
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  body: string
  cta: string
  href?: string
  onClick?: () => void
  primary?: boolean
  accent?: 'coral' | 'teal' | 'amber' | 'violet'
}) {
  // Map accent → CSS var. Each choice card gets its own color so the
  // grid reads as four distinct paths instead of a uniform wall of cards.
  const accentVar = {
    coral: 'var(--vibrant)',
    teal: 'var(--vibrant-2)',
    amber: 'var(--accent-warn)',
    violet: 'var(--chart-5)',
  }[accent]
  const accentSoft = {
    coral: 'var(--vibrant-soft)',
    teal: 'var(--vibrant-2-soft)',
    amber: 'oklch(0.62 0.16 65 / 0.14)',
    violet: 'oklch(0.5 0.1 280 / 0.14)',
  }[accent]

  const inner = (
    <div className="bg-background p-7 md:p-8 h-full flex flex-col relative group transition-colors">
      {/* Top stripe — the card's accent color. Brightens on hover so the
          grid looks calm by default and lights up as you explore. */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: accentVar }}
      />
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="h-7 w-7 flex items-center justify-center"
          style={{ backgroundColor: accentSoft, color: accentVar }}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-base font-semibold">{label}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-6 flex-1">{body}</p>
      <span
        className="text-sm self-start font-medium inline-flex items-center gap-1.5"
        style={{ color: accentVar }}
      >
        {cta} →
      </span>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:bg-muted/30 transition-colors">
        {inner}
      </Link>
    )
  }
  return (
    <button onClick={onClick} className="text-left hover:bg-muted/30 transition-colors h-full">
      {inner}
    </button>
  )
}
