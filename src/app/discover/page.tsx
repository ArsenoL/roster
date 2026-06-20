'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useFetch } from '@/lib/clubhub/hooks'
import { useDarkMode } from '@/lib/clubhub/use-dark-mode'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, Moon, Sun, ArrowRight, Users, Calendar, TrendingUp,  MapPin, GraduationCap, ChevronRight, Filter,
} from 'lucide-react'
import { CLUB_CATEGORIES, categoryEmoji, categoryLabel } from '@/lib/clubhub/types'

export default function DiscoverPage() {
  const { dark, toggle: toggleDark } = useDarkMode()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')


  const query = new URLSearchParams()
  if (search) query.set('search', search)
  if (category && category !== 'ALL') query.set('category', category)
  const { data, loading } = useFetch<{ clubs: any[] }>(`/api/clubs?${query.toString()}`)

  const clubs = (data?.clubs || []).filter(c => c.isPublic !== false)

  return (
    <div className="min-h-screen bg-background">
      {/* Header — civic */}
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Roster</span>
            <span className="hidden sm:inline-block label-mono border-l border-border pl-2 ml-1">
              discover
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link href="/"><MapPin className="h-3.5 w-3.5 mr-1" /> Home</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center max-w-2xl mx-auto py-6">
          <Badge variant="outline" className="mb-3 bg-brand-soft border-brand/30 text-brand-ink">
            <MapPin className="h-3 w-3 mr-1" /> Public club directory
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Find your next obsession.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Browse every public club on Roster. Click any club to see its mission, upcoming events, and apply to join — no account required to look around.
          </p>
        </div>

        {/* Search + filter bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by club name…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {CLUB_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${clubs.length} club${clubs.length !== 1 ? 's' : ''} found`}
          </div>
        </div>

        {/* Results grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
          </div>
        ) : clubs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <div className="font-semibold mb-1">No clubs found</div>
              <div className="text-sm text-muted-foreground">Try a different search term or category filter.</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map(club => (
              <ClubCard key={club.id} club={club} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-8">
          Don't see your club? <Link href="/login?next=/app/onboarding" className="text-brand hover:underline font-medium">Create one</Link> in 60 seconds.
        </div>
      </main>
    </div>
  )
}

function ClubCard({ club }: { club: any }) {
  const slug = club.slug || club.id
  return (
    <Link href={`/portal/${slug}`}>
      <Card className="h-full hover:shadow-lg hover:border-brand/30 hover:-translate-y-0.5 transition-all duration-200 group overflow-hidden">
        {/* Banner */}
        <div
          className="h-20 relative"
          style={{
            background: `linear-gradient(135deg, ${club.primaryColor || '#10b981'}40, ${club.accentColor || '#6366f1'}40)`,
          }}
        >
          <div className="absolute -bottom-6 left-4 w-12 h-12 rounded-xl bg-background border-2 border-background shadow-md flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${club.primaryColor}20` }}
          >
            {categoryEmoji(club.category)}
          </div>
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-[10px]">
              {categoryLabel(club.category)}
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 pt-8 space-y-3">
          <div>
            <div className="font-bold text-lg leading-tight group-hover:text-brand transition-colors">{club.name}</div>
            {club.president?.name && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <GraduationCap className="h-3 w-3" /> President: {club.president.name}
              </div>
            )}
          </div>

          {club.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{club.description}</p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {club.activeMembers || club._count?.members || 0}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {club._count?.events || 0}
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {club.attendanceRate || 0}%
            </span>
            <ChevronRight className="h-3 w-3 ml-auto group-hover:translate-x-0.5 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
