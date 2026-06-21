'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Menu,
  X,
  Sun,
  Moon,
  CalendarCheck,
  Users,
  DollarSign,
  ClipboardList,
  FileText,
  ShieldCheck,
  GraduationCap,
  School,
  Heart,
  Building2,
} from 'lucide-react'
import { useAuth } from '@/lib/clubhub/use-auth'
import { useDarkMode } from '@/lib/clubhub/use-dark-mode'
import { AuthAwareLink } from '@/components/clubhub/auth-aware-link'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const { dark, toggle: toggleDark } = useDarkMode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)


  const dashboardHref = user
    ? (user.role === 'STUDENT' ? '/app/me'
       : user.role === 'PARENT' ? '/app/parent'
       : '/app')
    : '/login'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ───────────────────── Top nav ─────────────────────
          Civic form aesthetic: ruled border-bottom, no glass, no blur,
          no rounded logo, no gradient. */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* Wordmark — no icon. Civic. */}
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              club operations
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/discover" className="text-muted-foreground hover:text-foreground transition-colors">
              Discover
            </Link>
            <a href="#jobs" className="text-muted-foreground hover:text-foreground transition-colors">
              What it does
            </a>
            <a href="#modules" className="text-muted-foreground hover:text-foreground transition-colors">
              Modules
            </a>
            <a href="#roles" className="text-muted-foreground hover:text-foreground transition-colors">
              For your role
            </a>
            <a href="#privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {loading ? null : user ? (
              <Button size="sm" asChild>
                <Link href={dashboardHref}>
                  Open dashboard <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Button size="sm" asChild>
                  <Link href="/demo">Try a demo</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex md:hidden items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <nav className="max-w-6xl mx-auto px-5 py-3 space-y-1">
              <Link href="/discover" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">
                Discover
              </Link>
              <a href="#jobs" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">
                What it does
              </a>
              <a href="#modules" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">
                Modules
              </a>
              <a href="#roles" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">
                For your role
              </a>
              <a href="#privacy" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm">
                Privacy
              </a>
              <div className="pt-2 border-t border-border mt-2 flex flex-col gap-2">
                {user ? (
                  <Button asChild size="sm">
                    <Link href={dashboardHref} onClick={() => setMobileMenuOpen(false)}>
                      Open dashboard
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link href="/demo" onClick={() => setMobileMenuOpen(false)}>
                        Try a demo
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* ───────────────────── Hero ─────────────────────
          Left-aligned headline + small vibrant accent ribbon. No gradient,
          no orbs. The coral ribbon above the headline and the coral CTA
          together carry the eye from "what is this" to "what do I do". */}
      <section className="border-b border-border relative overflow-hidden">
        {/* Faint coral wash in the top-right corner — a single color splash,
            not a full gradient. Uses CSS mask to fade out cleanly. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full"
          style={{
            background: 'var(--vibrant-soft)',
            maskImage: 'radial-gradient(circle, black 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 70%)',
          }}
        />
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-28 relative">
          <div className="max-w-2xl">
            {/* Coral ribbon — the single vibrant splash above the headline */}
            <div className="ribbon mb-6" />

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Run your club
              <br />
              without the spreadsheet sprawl.
            </h1>

            <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Roster handles the day-to-day of a high school club — attendance, members, events, hours,
              money, and the reports your advisor actually asks for. In-house, no third-party trackers,
              built FERPA- and COPPA-aware.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild className="h-11 px-5 btn-vibrant">
                {/* Auth-aware: signed-in users go straight to onboarding,
                    signed-out users go to /login?next=/app/onboarding.
                    Previously this hardcoded /login, which meant a signed-in
                    user clicking "Get started" would be shown the login form
                    again — confusing and broken. */}
                <AuthAwareLink href="/app/onboarding">
                  Get started <ArrowRight className="h-4 w-4 ml-2" />
                </AuthAwareLink>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-11 px-5">
                <Link href="/demo">Try a demo</Link>
              </Button>
            </div>

            {/* Thin ruled strip of plain-language facts (no fabricated numbers) */}
            <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center gap-x-6 gap-y-2 label-mono">
              <span>No third-party trackers</span>
              <span className="hidden sm:inline border-l border-border pl-6">Magic-link sign-in</span>
              <span className="hidden sm:inline border-l border-border pl-6">FERPA / COPPA-aware</span>
              <span className="border-l border-border pl-6">Runs on a school-owned database</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── The job (replaces "Features grid") ─────────────────────
          Describe what users DO, not how many modules exist. */}
      <section id="jobs" className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
          <div className="max-w-2xl mb-14">
            <div className="label-mono mb-3">What it does</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Four jobs that used to take five tools.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Roster isn&apos;t a feature list. It&apos;s the work your execs already do, in one place
              that doesn&apos;t require a Slack, a spreadsheet, and a shared Drive to function.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
            <JobCard
              icon={CalendarCheck}
              title="Take attendance"
              summary="Open the kiosk on a laptop at the door. Members check in with a code or a tap. Excuses land in a queue for review."
              points={[
                'Kiosk mode with rotating 4-digit code or per-member QR',
                'Automatic streak tracking and at-risk flagging',
                'Parent-submitted absence excuses flow into a review queue',
              ]}
            />
            <JobCard
              icon={Users}
              title="Track members and hours"
              summary="Roster, applications, offboarding, alumni, volunteer hours — all linked to the same person record. Custom fields for whatever your school requires."
              points={[
                'Bulk import from a CSV; students self-apply via public portal',
                'Volunteer hours submitted by members, approved by execs',
                'Alumni stay linked to the club after graduation',
              ]}
            />
            <JobCard
              icon={DollarSign}
              title="Run the money"
              summary="Dues, expenses, balances. Every transaction recorded with who, when, and why. Audit-ready by default — not retroactively."
              points={[
                'Dues tracking per member with reminder automation',
                'Expenses logged with receipt URL and category',
                'Exportable to CSV for advisor or admin review',
              ]}
            />
            <JobCard
              icon={ClipboardList}
              title="Report up"
              summary="Generate the weekly digest your advisor asks for, the semester report the principal wants, and the year-end summary the school board needs — from the same data."
              points={[
                'Saved views: build a report once, re-run any time',
                'Scheduled email digests to members, parents, or advisors',
                'Full audit log of every create, update, and delete',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ───────────────────── Modules ─────────────────────
          The firebase argument: you pick what you need. Nothing is
          enabled by default beyond the three things every club has
          (members, attendance, events). Everything else is opt-in. */}
      <section id="modules" className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
          <div className="max-w-2xl mb-14">
            <div className="label-mono mb-3">Modules</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Pick what this club actually needs.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Roster ships with 30+ modules. None of them are on by default except the
              three things every club has — members, attendance, events. Everything else
              is a toggle in Settings. Turn on finance if you collect dues. Turn on
              volunteer hours if you&apos;re a service club. Turn on inventory if you have
              equipment. Leave the rest off — they don&apos;t clutter the sidebar, they
              don&apos;t show up in onboarding, they don&apos;t confuse new members.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
            <ModuleCard
              header="Always on"
              tone="Core"
              items={[
                'Members — the roster itself',
                'Attendance — manual roll, kiosk check-in',
                'Events — when meetings happen',
              ]}
              footer="The literal definition of a club. Can\'t be turned off."
            />
            <ModuleCard
              header="Turn on if you need it"
              tone="Opt-in"
              items={[
                'Finance — dues, expenses, balances',
                'Volunteer hours — for service clubs',
                'Inventory — for clubs with equipment',
                'Forms & surveys — waivers, feedback',
                'Announcements — if you don\'t use a group chat',
                'Tasks — if your exec team shares work',
              ]}
              footer="20+ more available. Toggle from Settings → Modules anytime."
            />
            <ModuleCard
              header="Off by default, on purpose"
              tone="Won't appear"
              items={[
                'Parent portal — most high school clubs don\'t need it',
                'Gamification — engagement points & badges',
                'Photo albums — event galleries',
                'Polls & elections',
                'Meeting minutes — for secretary-heavy clubs',
                'Integrations — webhooks & API keys',
              ]}
              footer="Not a judgment — just not on by default. Add what you need."
            />
          </div>
        </div>
      </section>

      {/* ───────────────────── For your role ─────────────────────
          Plain language, no decorative icons-in-circles. Each role gets a single
          column with what they can actually do. */}
      <section id="roles" className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
          <div className="max-w-2xl mb-14">
            <div className="label-mono mb-3">For your role</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Each screen is built for the person who actually uses it.
            </h2>
            <p className="mt-4 text-muted-foreground">
              We don&apos;t pretend everyone gets the same dashboard. The exec taking roll sees one
              thing; the parent checking on their kid sees another. Below is who sees what.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border">
            {/* RoleColumn's href is now auth-aware internally: signed-in
                users go straight to the role-specific landing page; signed-out
                users go to /login?next=<that page>. Previously every CTA
                hard-coded /login?next=... which sent signed-in users back to
                the login form. */}
            <RoleColumn
              icon={GraduationCap}
              role="Club exec"
              href="/app/onboarding"
              items={[
                'Take attendance at the door',
                'Email the week ahead to members',
                'Approve expenses and volunteer hours',
                'See who is falling off before they quit',
              ]}
            />
            <RoleColumn
              icon={School}
              role="Teacher / advisor"
              href="/app"
              items={[
                'Read-only view of every club you sponsor',
                'Step in to approve excuses or expenses',
                'Pull the audit log for any action',
                'Get the same digests parents get',
              ]}
            />
            <RoleColumn
              icon={Users}
              role="Student member"
              href="/app/me"
              items={[
                'See your attendance, hours, and points',
                'RSVP to upcoming events',
                'Submit an absence excuse',
                'Message your execs in-app',
              ]}
            />
            <RoleColumn
              icon={Heart}
              role="Parent / guardian"
              href="/app/parent"
              items={[
                'Token-based access — no full account needed',
                'See your kid\u2019s attendance and upcoming events',
                'Submit an absence excuse from your phone',
                'Read club announcements',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ───────────────────── Privacy ─────────────────────
          Specific about training and selling — no hedging. */}
      <section id="privacy" className="border-b border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-1">
              <div className="label-mono mb-3">Privacy</div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Built for the fact that this data is about minors.
              </h2>
            </div>

            <div className="lg:col-span-2 space-y-6 text-muted-foreground leading-relaxed">
              <p>
                Roster runs on a database the school controls. There are no third-party analytics
                scripts, no ad pixels, no behavioral telemetry. The only outbound requests are the
                ones you trigger — magic-link emails, digest emails, and (if you turn it on) the
                Assistant feature, which calls the Gemini API with the question you asked and the
                data needed to answer it.
              </p>

              <div className="border border-border p-5">
                <div className="label-mono mb-3">What we don&apos;t do</div>
                <ul className="space-y-2.5 text-sm">
                  <li className="flex gap-3">
                    <span className="text-foreground mt-2 h-px w-4 bg-foreground shrink-0" aria-hidden />
                    <span><strong className="text-foreground">No training.</strong> Student data is never sent to any model training pipeline. The Gemini API call used by the Assistant feature is made with Google&apos;s &quot;API data not used to train models&quot; setting, and the call only includes the slice of data needed to answer the specific question you asked — not the whole database. Everything else (attendance, dues, hours, audit log) stays in the school-controlled SQLite file and is never transmitted anywhere.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-foreground mt-2 h-px w-4 bg-foreground shrink-0" aria-hidden />
                    <span><strong className="text-foreground">No selling.</strong> We do not sell, rent, license, or share student data with any third party — no data brokers, no advertisers, no education analytics marketplaces, no &quot;partners.&quot; There is no business model that monetizes the data itself. The only people who can read student records are the authorized roles configured in the app.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-foreground mt-2 h-px w-4 bg-foreground shrink-0" aria-hidden />
                    <span><strong className="text-foreground">No tracking.</strong> No cookies for analytics, no fingerprinting, no cross-site tracking. Session cookies are strictly for authentication.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-foreground mt-2 h-px w-4 bg-foreground shrink-0" aria-hidden />
                    <span><strong className="text-foreground">No retention games.</strong> When a club is deleted, its records are deleted — not soft-deleted, not archived, not &quot;retained for analytics.&quot; Alumni records persist only if the club explicitly keeps them.</span>
                  </li>
                </ul>
              </div>

              <p>
                Student records are scoped to authorized roles. Parents get token-based access to
                their own child&apos;s information — no shared password, no broad account. The audit
                log records every create, update, and delete with timestamp, actor, and before/after
                state, and is exportable for compliance review.
              </p>
              <p>
                FERPA-aware data handling. COPPA-aware under-13 mode that requires a parent-linked
                account. None of this is marketing copy — it&apos;s how the schema, the API, and the
                auth layer are actually built.
              </p>

              <div className="pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
                <PrivacyBadge icon={ShieldCheck} label="FERPA-aware" />
                <PrivacyBadge icon={Users} label="COPPA-aware" />
                <PrivacyBadge icon={FileText} label="Full audit log" />
                <PrivacyBadge icon={Building2} label="Self-hosted data" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── Footer ───────────────────── */}
      <footer className="bg-background">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="text-base font-semibold">Roster</span>
            <span className="label-mono">club operations for high schools</span>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/discover" className="text-muted-foreground hover:text-foreground">
              Discover
            </Link>
            {/* Footer "Sign in" link: if the user is already signed in,
                send them to their dashboard instead of the login form. */}
            <AuthAwareLink href="/app" className="text-muted-foreground hover:text-foreground">
              {user ? 'Dashboard' : 'Sign in'}
            </AuthAwareLink>
            <Link href="/demo" className="text-muted-foreground hover:text-foreground">
              Try a demo
            </Link>
          </nav>
          <div className="label-mono">© {new Date().getFullYear()} Roster</div>
        </div>
      </footer>
    </div>
  )
}

/* ───────────────────────── Sub-components ───────────────────────── */

function JobCard({
  icon: Icon,
  title,
  summary,
  points,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  summary: string
  points: string[]
}) {
  return (
    <div className="bg-background p-7 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <Icon className="h-5 w-5 text-foreground" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{summary}</p>
      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5 text-sm">
            <span className="text-foreground mt-2 h-px w-3 bg-foreground shrink-0" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoleColumn({
  icon: Icon,
  role,
  href,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>
  role: string
  href: string
  items: string[]
}) {
  return (
    <div className="bg-background p-7 md:p-8 flex flex-col">
      <div className="flex items-center gap-2.5 mb-4">
        <Icon className="h-4 w-4 text-foreground" />
        <div className="label-mono">{role}</div>
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {items.map((item) => (
          <li key={item} className="text-sm leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
      {/* AuthAwareLink: signed-in → go straight to `href`;
          signed-out → /login?next=<href>. Replaces a plain <Link> that
          always pointed at /login?next=... and confused signed-in users. */}
      <AuthAwareLink
        href={href}
        className="text-sm text-foreground link-u self-start"
      >
        Continue as {role.split(' ')[0].toLowerCase()} →
      </AuthAwareLink>
    </div>
  )
}

function ModuleCard({
  header,
  tone,
  items,
  footer,
}: {
  header: string
  tone: 'Core' | 'Opt-in' | "Won't appear"
  items: string[]
  footer: string
}) {
  return (
    <div className="bg-background p-7 md:p-8 flex flex-col">
      <div className="label-mono mb-3">{tone}</div>
      <h3 className="text-lg font-semibold mb-4">{header}</h3>
      <ul className="space-y-2 mb-6 flex-1">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="text-foreground mt-2 h-px w-3 bg-foreground shrink-0" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground leading-relaxed pt-4 border-t border-border">
        {footer}
      </p>
    </div>
  )
}

function PrivacyBadge({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-foreground" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
