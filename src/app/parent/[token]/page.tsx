'use client'

import { use, useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { School, Loader2, AlertCircle, Calendar, Mail, Phone, Award, TrendingUp, GraduationCap } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function ParentPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>(null)
  const [selectedStudent, setSelectedStudent] = useState(0)
  const [excuseOpen, setExcuseOpen] = useState<string | null>(null)
  const [excuseForm, setExcuseForm] = useState({ reason: 'ILLNESS', description: '' })

  useEffect(() => {
    fetch(`/api/parent-portal?token=${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json()
          throw new Error(d.error || 'Failed to load')
        }
        return r.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  async function submitExcuse(eventId: string, userId: string) {
    try {
      const res = await fetch('/api/parent-portal/absence-excuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, eventId, userId,
          reason: excuseForm.reason,
          description: excuseForm.description,
        }),
      })
      if (res.ok) {
        setExcuseOpen(null)
        setExcuseForm({ reason: 'ILLNESS', description: '' })
        // Refresh data
        const refreshed = await fetch(`/api/parent-portal?token=${token}`).then(r => r.json())
        setData(refreshed)
      } else {
        const d = await res.json()
        alert(d.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Couldn't open the parent portal</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const student = data.students[selectedStudent]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
              <School className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Parent Portal</h1>
              <p className="text-xs text-muted-foreground">Welcome, {data.parent.name}</p>
            </div>
          </div>
          <Badge variant="outline">Read-only access · {data.students.length} student(s)</Badge>
        </div>

        {/* Student selector */}
        {data.students.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {data.students.map((s: any, i: number) => (
              <Button
                key={s.student.id}
                variant={i === selectedStudent ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedStudent(i)}
              >
                {s.student.name}
              </Button>
            ))}
          </div>
        )}

        {/* Student profile */}
        <Card className="mb-4">
          <CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-emerald-500 text-white text-lg">
                {student.student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-lg font-semibold">{student.student.name}</h2>
              <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                {student.student.grade && <span>Grade {student.student.grade}</span>}
                {student.student.graduationYear && <span>Class of {student.student.graduationYear}</span>}
                {student.student.house && <span>House: {student.student.house}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-club breakdown */}
        <div className="space-y-4">
          {student.clubs.map((clubData: any) => (
            <Card key={clubData.club.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: clubData.club.primaryColor }} />
                      {clubData.club.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {clubData.membership.role} · {clubData.membership.points} points · {clubData.membership.streak}🔥 streak
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Attendance summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-emerald-600">{Math.round(clubData.attendance.rate * 100)}%</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Attendance</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{clubData.attendance.present}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Present</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-amber-600">{clubData.attendance.total}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Total Events</div>
                  </div>
                </div>

                {/* Upcoming events */}
                {clubData.upcomingEvents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1"><Calendar className="h-3 w-3" /> Upcoming Events</h4>
                    <div className="space-y-1.5">
                      {clubData.upcomingEvents.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between text-sm border-l-2 pl-3 py-1" style={{ borderColor: clubData.club.primaryColor }}>
                          <div>
                            <div className="font-medium">{e.title}</div>
                            <div className="text-xs text-muted-foreground">{new Date(e.startTime).toLocaleString()} · {e.location || 'No location'}</div>
                          </div>
                          {student.canExcuseAbsences && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setExcuseOpen(e.id); setExcuseForm({ reason: 'ILLNESS', description: '' }); }}
                            >
                              Excuse absence
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent announcements */}
                {clubData.announcements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Recent Announcements</h4>
                    <div className="space-y-2">
                      {clubData.announcements.map((a: any) => (
                        <div key={a.id} className="bg-muted/40 p-2 rounded text-sm">
                          <div className="font-medium text-xs">{a.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Excuse dialog */}
                {excuseOpen && clubData.upcomingEvents.find((e: any) => e.id === excuseOpen) && (
                  <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 space-y-3">
                    <h4 className="text-sm font-semibold">Excuse absence for {clubData.upcomingEvents.find((e: any) => e.id === excuseOpen)?.title}</h4>
                    <div>
                      <Label>Reason</Label>
                      <Select value={excuseForm.reason} onValueChange={(v) => setExcuseForm({ ...excuseForm, reason: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ILLNESS">Illness</SelectItem>
                          <SelectItem value="FAMILY">Family obligation</SelectItem>
                          <SelectItem value="ACADEMIC">Academic conflict</SelectItem>
                          <SelectItem value="RELIGIOUS">Religious observance</SelectItem>
                          <SelectItem value="TRANSPORTATION">Transportation issue</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Details (optional)</Label>
                      <Textarea
                        value={excuseForm.description}
                        onChange={(e) => setExcuseForm({ ...excuseForm, description: e.target.value })}
                        rows={2}
                        placeholder="Additional context for the club advisor"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setExcuseOpen(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => submitExcuse(excuseOpen, student.student.id)}>Submit excuse</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
