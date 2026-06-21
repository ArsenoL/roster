import { db } from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CalendarCheck, Users, DollarSign, ClipboardList, ArrowRight, ShieldCheck } from 'lucide-react'
import { formatDate, formatTime, categoryLabel } from '@/lib/clubhub/types'

export const dynamic = 'force-dynamic'

async function getDemoClub() {
  // Pick the public club with the most events for a richer demo.
  // Stable choice so the demo doesn't shift between visits.
  const clubs = await db.club.findMany({
    where: { isPublic: true, status: 'ACTIVE' },
    include: {
      _count: { select: { members: true, events: true, announcements: true } },
    },
    orderBy: { name: 'asc' },
  })
  if (!clubs.length) return null
  // Use "Robotics & Engineering Society" if present, else the first one.
  return clubs.find((c) => c.slug === 'robotics-engineering-society') ?? clubs[0]
}

export default async function DemoPage() {
  const club = await getDemoClub()
  if (!club) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="max-w-md text-center px-6">
          <h1 className="text-xl font-semibold mb-2">No demo club available</h1>
          <p className="text-sm text-muted-foreground mb-6">
            The seeded demo data isn&apos;t present. Try signing in and creating a club instead.
          </p>
          <Button asChild>
            <Link href="/login?next=/app/onboarding">Get started</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Pull the four data sources the demo shows.
  const [members, upcomingEvents, recentAttendance, announcements] = await Promise.all([
    db.membership.findMany({
      where: { clubId: club.id, status: 'ACTIVE' },
      include: { user: { select: { name: true, email: true, grade: true, graduationYear: true } } },
      take: 12,
      orderBy: { joinedAt: 'asc' },
    }),
    db.event.findMany({
      where: { clubId: club.id, startTime: { gte: new Date() } },
      take: 5,
      orderBy: { startTime: 'asc' },
    }),
    db.event.findMany({
      where: { clubId: club.id, startTime: { lt: new Date() } },
      take: 5,
      orderBy: { startTime: 'desc' },
      include: { _count: { select: { attendances: true } } },
    }),
    db.announcement.findMany({
      where: { clubId: club.id },
      take: 3,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Compute attendance rate across the club's history.
  const totalAttendance = await db.attendance.count({
    where: { event: { clubId: club.id }, status: { in: ['PRESENT', 'LATE', 'VIRTUAL'] } },
  })
  const totalRecords = await db.attendance.count({ where: { event: { clubId: club.id } } })
  const attendanceRate = totalRecords > 0 ? Math.round((totalAttendance / totalRecords) * 100) : 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ───── Top banner: demo mode + civic aesthetic ───── */}
      <header className="border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              club operations
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/discover"
              className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
            >
              Browse public clubs
            </Link>
            <Button size="sm" asChild>
              <Link href="/login?next=/app/onboarding">
                Start your own <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ───── Demo banner ───── */}
      <div className="border-b border-border bg-muted">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="label-mono">Demo mode</span>
            <span className="text-muted-foreground">
              You&apos;re viewing <strong className="text-foreground">{club.name}</strong> as a visitor.
              Actions are disabled — sign in to take attendance, edit members, or run reports.
            </span>
          </div>
          <Button size="sm" variant="outline" asChild className="shrink-0">
            <Link href="/login">Sign in to act</Link>
          </Button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 md:py-14">
        {/* ───── Club header ───── */}
        <div className="pb-6 border-b border-border mb-8">
          <div className="label-mono mb-2">{categoryLabel(club.category)} · {club.meetingRoom ?? 'Room TBD'}</div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{club.name}</h1>
          {club.description && (
            <p className="mt-3 text-muted-foreground max-w-2xl leading-relaxed">{club.description}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 label-mono">
            <span>{club._count.members} members</span>
            <span className="border-l border-border pl-5">{club._count.events} events on record</span>
            <span className="border-l border-border pl-5">{attendanceRate}% attendance rate</span>
            {club.defaultDay && (
              <span className="border-l border-border pl-5">
                Meets {club.defaultDay} {club.defaultTime ?? ''}
              </span>
            )}
          </div>
        </div>

        {/* ───── KPI strip ───── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border border-border mb-10">
          <Kpi icon={Users} label="Active members" value={String(club._count.members)} />
          <Kpi icon={CalendarCheck} label="Events on record" value={String(club._count.events)} />
          <Kpi icon={CalendarCheck} label="Attendance rate" value={`${attendanceRate}%`} />
          <Kpi icon={ClipboardList} label="Announcements" value={String(club._count.announcements)} />
        </div>

        {/* ───── Two-column body: upcoming + recent ───── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
          {/* Upcoming events */}
          <section>
            <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-border">
              <h2 className="text-base font-semibold">Upcoming events</h2>
              <span className="label-mono">{upcomingEvents.length} scheduled</span>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events scheduled.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingEvents.map((e) => (
                  <li key={e.id} className="py-3 flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{e.title}</div>
                      <div className="label-mono mt-0.5">
                        {formatDate(e.startTime)} · {formatTime(e.startTime)}
                        {e.location ? ` · ${e.location}` : ''}
                      </div>
                    </div>
                    <span className="label-mono">{e.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent meetings + attendance counts */}
          <section>
            <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-border">
              <h2 className="text-base font-semibold">Recent meetings</h2>
              <span className="label-mono">last {recentAttendance.length}</span>
            </div>
            {recentAttendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past meetings on record.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentAttendance.map((e) => (
                  <li key={e.id} className="py-3 flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{e.title}</div>
                      <div className="label-mono mt-0.5">
                        {formatDate(e.startTime)} · {formatTime(e.startTime)}
                      </div>
                    </div>
                    <span className="label-mono">{e._count.attendances} checked in</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ───── Members table (read-only, dense) ───── */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-border">
            <h2 className="text-base font-semibold">Members</h2>
            <span className="label-mono">showing first {members.length} of {club._count.members}</span>
          </div>
          <div className="border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium label-mono">Name</th>
                  <th className="px-4 py-2.5 font-medium label-mono">Grade</th>
                  <th className="px-4 py-2.5 font-medium label-mono">Graduates</th>
                  <th className="px-4 py-2.5 font-medium label-mono">Joined</th>
                  <th className="px-4 py-2.5 font-medium label-mono">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5">{m.user.name}</td>
                    <td className="px-4 py-2.5 mono">{m.user.grade ?? '—'}</td>
                    <td className="px-4 py-2.5 mono">{m.user.graduationYear ?? '—'}</td>
                    <td className="px-4 py-2.5 mono">{formatDate(m.joinedAt)}</td>
                    <td className="px-4 py-2.5 mono">{m.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ───── Announcements ───── */}
        {announcements.length > 0 && (
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-border">
              <h2 className="text-base font-semibold">Recent announcements</h2>
              <span className="label-mono">last {announcements.length}</span>
            </div>
            <ul className="space-y-4">
              {announcements.map((a) => (
                <li key={a.id} className="border border-border p-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <h3 className="text-sm font-semibold">{a.title}</h3>
                    <span className="label-mono">{formatDate(a.createdAt)}</span>
                  </div>
                  {a.content && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{a.content}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ───── Bottom CTAs ───── */}
        <section className="border-t border-border pt-8 mt-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border">
            <CtaCell
              icon={ArrowRight}
              title="Start your own club"
              body="Sign in with your school email, name your club, and you're running. No setup wizard, no payment."
              cta="Get started"
              href="/login?next=/app/onboarding"
            />
            <CtaCell
              icon={ShieldCheck}
              title="See it from the inside"
              body="If your school already runs Roster, sign in to see the clubs you're a member of."
              cta="Sign in"
              href="/login"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex items-center justify-between label-mono">
          <span>© {new Date().getFullYear()} Roster</span>
          <Link href="/" className="hover:text-foreground">Back to home</Link>
        </div>
      </footer>
    </div>
  )
}

/* ───── Helpers ───── */

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="bg-background p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="label-mono">{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-semibold mono">{value}</div>
    </div>
  )
}

function CtaCell({
  icon: Icon,
  title,
  body,
  cta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  cta: string
  href: string
}) {
  return (
    <div className="bg-background p-7 md:p-8 flex flex-col">
      <div className="flex items-center gap-2.5 mb-3">
        <Icon className="h-4 w-4 text-foreground" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{body}</p>
      <Button asChild className="self-start">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  )
}
