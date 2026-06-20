'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trophy, Flame, Crown, Plus, Award, Star, Zap, Target, Medal, Gift, TrendingUp } from 'lucide-react'
import { BADGE_TIERS, avatarColor, initials, type Badge } from '@/lib/clubhub/types'
import { toast } from 'sonner'

export function GamificationTab({ clubId }: { clubId: string }) {
 const badgesUrl = clubId !== 'ALL' ? `/api/badges?clubId=${clubId}` : `/api/badges`
 const engagementUrl = `/api/analytics?view=engagement${clubId !== 'ALL' ? `&clubId=${clubId}` : ''}`

 const { data: badgesData, loading: l1, refetch: refetchBadges } = useFetch<{ badges: Badge[] }>(badgesUrl)
 const { data: engagement, loading: l2 } = useFetch<any>(engagementUrl)

 const [createOpen, setCreateOpen] = useState(false)
 const [awardBadgeId, setAwardBadgeId] = useState<string | null>(null)

 const badges = badgesData?.badges || []
 const leaderboard = (engagement?.members || [])
 .slice()
 .sort((a: any, b: any) => b.points - a.points)
 .slice(0, 25)

 return (
 <Tabs defaultValue="leaderboard" className="space-y-4">
 <TabsList>
 <TabsTrigger value="leaderboard"><Crown className="h-3.5 w-3.5 mr-1" /> Leaderboard</TabsTrigger>
 <TabsTrigger value="badges"><Award className="h-3.5 w-3.5 mr-1" /> Badges</TabsTrigger>
 <TabsTrigger value="streaks"><Flame className="h-3.5 w-3.5 mr-1" /> Streaks</TabsTrigger>
 </TabsList>

 {/* LEADERBOARD */}
 <TabsContent value="leaderboard" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-foreground" /> Points Leaderboard</CardTitle>
 <CardDescription>Top members by accumulated points</CardDescription>
 </CardHeader>
 <CardContent>
 {l2 ? (
 <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
 ) : leaderboard.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">No data yet</div>
 ) : (
 <div className="space-y-1.5">
 {leaderboard.map((m: any, i: number) => (
 <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg ${i < 3 ? 'bg-muted from-yellow-50 to-transparent dark:from-yellow-950/20' : 'hover:bg-accent/30'} border`}>
 <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold shrink-0 ${
 i === 0 ? 'bg-yellow-400 text-white' :
 i === 1 ? 'bg-slate-300 text-white' :
 i === 2 ? 'bg-foreground text-white' :
 'bg-muted text-muted-foreground'
 }`}>
 {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
 </div>
 <Avatar className="h-10 w-10" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-xs font-medium">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="font-medium truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground flex items-center gap-2">
 <Flame className="h-3 w-3 text-foreground" /> {m.streak} streak
 <span>·</span>
 <Trophy className="h-3 w-3 text-foreground" /> Best: {m.longestStreak}
 <span>·</span>
 {m.club?.name}
 </div>
 </div>
 <div className="text-right shrink-0">
 <div className="text-xl font-bold text-foreground">{m.points}</div>
 <div className="text-xs text-muted-foreground">points</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* BADGES */}
 <TabsContent value="badges" className="space-y-4">
 <div className="flex items-center justify-between">
 <p className="text-sm text-muted-foreground">Award badges to recognize member achievements.</p>
 <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create Badge</Button>
 </div>

 {l1 ? (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
 </div>
 ) : badges.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>No badges yet. Create one to start recognizing members!</p>
 </CardContent></Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {badges.map(b => (
 <BadgeCard key={b.id} badge={b} onAward={() => setAwardBadgeId(b.id)} />
 ))}
 </div>
 )}
 </TabsContent>

 {/* STREAKS */}
 <TabsContent value="streaks" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-foreground" /> Attendance Streaks</CardTitle>
 <CardDescription>Members with the longest current streaks</CardDescription>
 </CardHeader>
 <CardContent>
 {l2 ? (
 <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
 ) : (
 <div className="space-y-1.5">
 {(engagement?.members || [])
 .slice()
 .sort((a: any, b: any) => b.streak - a.streak)
 .slice(0, 20)
 .map((m: any, i: number) => (
 <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30">
 <div className="text-2xl">{i === 0 ? '🔥' : i < 3 ? '⚡' : '•'}</div>
 <Avatar className="h-9 w-9" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-xs">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground">{m.club?.name}</div>
 </div>
 <div className="text-right">
 <div className="flex items-center gap-1 text-lg font-bold text-foreground">
 <Flame className="h-4 w-4" />
 {m.streak}
 </div>
 <div className="text-xs text-muted-foreground">Best: {m.longestStreak}</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 <CreateBadgeDialog
 open={createOpen}
 onOpenChange={setCreateOpen}
 clubId={clubId}
 onCreated={() => refetchBadges()}
 />

 <AwardBadgeDialog
 badgeId={awardBadgeId}
 onOpenChange={(o) => !o && setAwardBadgeId(null)}
 onAwarded={() => { refetchBadges(); setAwardBadgeId(null) }}
 />
 </Tabs>
 )
}

function BadgeCard({ badge, onAward }: { badge: Badge, onAward: () => void }) {
 return (
 <Card className="overflow-hidden">
 <div className="h-2" style={{ backgroundColor: badge.color }} />
 <CardContent className="p-4">
 <div className="flex items-start gap-3">
 <div className="text-4xl">{badge.icon}</div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold truncate">{badge.name}</h3>
 <Badge variant="outline" className="text-[10px]"
 style={{ backgroundColor: BADGE_TIERS.find(t => t.value === badge.tier)?.color + '30', color: BADGE_TIERS.find(t => t.value === badge.tier)?.color }}
 >
 {badge.tier}
 </Badge>
 </div>
 <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{badge.description}</p>
 <div className="flex items-center justify-between mt-3">
 <div className="text-xs">
 <span className="text-foreground font-medium">+{badge.points} pts</span>
 <span className="text-muted-foreground ml-2">· {badge._count?.userBadges || 0} awarded</span>
 </div>
 <Button size="sm" variant="outline" onClick={onAward}>
 <Gift className="h-3.5 w-3.5 mr-1" /> Award
 </Button>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 )
}

function CreateBadgeDialog({ open, onOpenChange, clubId, onCreated }: {
 open: boolean
 onOpenChange: (o: boolean) => void
 clubId: string
 onCreated: () => void
}) {
 const [form, setForm] = useState({
 name: '', description: '', icon: '🏆', color: '#f59e0b', tier: 'BRONZE', points: 10
 })

 const iconOptions = ['🏆', '⭐', '🎯', '🔥', '🤝', '💡', '🎨', '📚', '⚡', '🌟', '💎', '🚀', '🎖️', '👑', '🌈', '🦸']
 const colorOptions = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg">
 <DialogHeader>
 <DialogTitle>Create Badge</DialogTitle>
 <DialogDescription>Design a new badge to recognize member achievements.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Badge Name</Label>
 <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Perfect Attendance" />
 </div>
 <div>
 <Label>Description</Label>
 <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What did they do to earn this?" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Icon</Label>
 <div className="flex flex-wrap gap-1.5 p-2 border rounded-md">
 {iconOptions.map(i => (
 <button key={i} type="button"
 onClick={() => setForm({ ...form, icon: i })}
 className={`w-8 h-8 rounded text-lg ${form.icon === i ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-accent'}`}
 >{i}</button>
 ))}
 </div>
 </div>
 <div>
 <Label>Color</Label>
 <div className="flex flex-wrap gap-1.5 p-2 border rounded-md">
 {colorOptions.map(c => (
 <button key={c} type="button"
 onClick={() => setForm({ ...form, color: c })}
 className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-foreground' : 'border-transparent'}`}
 style={{ backgroundColor: c }}
 />
 ))}
 </div>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Tier</Label>
 <Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {BADGE_TIERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Points</Label>
 <Input type="number" value={form.points} onChange={e => setForm({ ...form, points: parseInt(e.target.value) || 0 })} />
 </div>
 </div>
 <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3">
 <div className="text-3xl">{form.icon}</div>
 <div>
 <div className="font-medium text-sm">{form.name || 'Badge name'}</div>
 <div className="text-xs text-muted-foreground">{form.description || 'Description'}</div>
 </div>
 <Badge variant="outline" className="ml-auto" style={{ color: form.color }}>{form.tier}</Badge>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={async () => {
 if (clubId === 'ALL') { toast.error('Select a specific club first'); return }
 try {
 await apiPost('/api/badges', { ...form, clubId })
 toast.success('Badge created')
 setForm({ name: '', description: '', icon: '🏆', color: '#f59e0b', tier: 'BRONZE', points: 10 })
 onOpenChange(false)
 onCreated()
 } catch (e: any) { toast.error(e.message) }
 }} disabled={!form.name || clubId === 'ALL'}>Create Badge</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function AwardBadgeDialog({ badgeId, onOpenChange, onAwarded }: {
 badgeId: string | null
 onOpenChange: (o: boolean) => void
 onAwarded: () => void
}) {
 const [search, setSearch] = useState('')
 const [selected, setSelected] = useState<Set<string>>(new Set())

 // Get badge info + eligible members
 const { data: badgeData } = useFetch<{ badge: any }>(badgeId ? `/api/badges?clubId=` : null)
 const clubId = badgeData?.badge?.clubId
 const { data: membersData, loading } = useFetch<{ members: any[] }>(
 badgeId && clubId ? `/api/members?clubId=${clubId}&search=${encodeURIComponent(search)}&limit=50` : null
 )

 const members = membersData?.members || []

 const handleAward = async () => {
 if (selected.size === 0 || !badgeId) return
 try {
 const r = await apiPost('/api/badges/award', { badgeId, userIds: Array.from(selected) })
 toast.success(`Awarded to ${r.awarded} member${r.awarded !== 1 ? 's' : ''}`)
 onAwarded()
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={!!badgeId} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-xl">
 <DialogHeader>
 <DialogTitle>Award Badge</DialogTitle>
 <DialogDescription>Select members to receive this badge.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." />
 {loading ? (
 <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
 ) : (
 <ScrollArea className="h-72">
 <div className="space-y-1">
 {members.map(m => (
 <label key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 cursor-pointer border">
 <input
 type="checkbox"
 checked={selected.has(m.userId)}
 onChange={() => {
 const next = new Set(selected)
 if (next.has(m.userId)) next.delete(m.userId)
 else next.add(m.userId)
 setSelected(next)
 }}
 className="h-4 w-4"
 />
 <Avatar className="h-8 w-8" style={{ backgroundColor: avatarColor(m.user.name) }}>
 <AvatarFallback className="text-white text-[10px]">{initials(m.user.name)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm truncate">{m.user.name}</div>
 <div className="text-xs text-muted-foreground">G{m.user.grade} · {m.role}</div>
 </div>
 </label>
 ))}
 </div>
 </ScrollArea>
 )}
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={handleAward} disabled={selected.size === 0}>
 <Gift className="h-4 w-4 mr-1" /> Award to {selected.size} member{selected.size !== 1 ? 's' : ''}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
