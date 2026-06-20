'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarCheck, CheckCircle2, AlertCircle, Loader2, Clock, MapPin, Users } from 'lucide-react'

type Step = 'enter-code' | 'event-found' | 'enter-email' | 'success' | 'already' | 'error'

interface EventInfo {
  id: string
  title: string
  startTime: string
  endTime: string
  location: string | null
  capacity: number | null
  checkedIn: number
}
interface ClubInfo { id: string; name: string; primaryColor: string }

export default function KioskPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('enter-code')
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [club, setClub] = useState<ClubInfo | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-uppercase the code
  useEffect(() => {
    setCode(code.toUpperCase())
  }, [code])

  async function lookupCode() {
    if (code.length < 4) { setError('Enter the full code shown on the projector'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/kiosk?code=${encodeURIComponent(code)}`)
      if (!res.ok) {
        const d = await res.json()
        setStep('error')
        setError(d.error || 'Invalid code')
        return
      }
      const d = await res.json()
      setEvent(d.event); setClub(d.club)
      setStep('event-found')
    } catch (e: any) { setError(e.message); setStep('error') }
    setLoading(false)
  }

  async function checkIn() {
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, name }),
      })
      const d = await res.json()
      if (d.alreadyCheckedIn) {
        setResult(d); setStep('already')
      } else if (d.ok) {
        setResult(d); setStep('success')
      } else {
        setError(d.error || 'Check-in failed'); setStep('error')
      }
    } catch (e: any) { setError(e.message); setStep('error') }
    setLoading(false)
  }

  function reset() {
    setStep('enter-code'); setCode(''); setEmail(''); setName(''); setResult(null); setError('')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-foreground" />
            <div>
              <div className="font-semibold leading-none">Roster Kiosk</div>
              <div className="label-mono leading-none mt-1">Self-service check-in</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Exit kiosk</Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {step === 'enter-code' && (
            <Card className="shadow-xl">
              <CardContent className="p-8 space-y-6 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CalendarCheck className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Check In</h1>
                  <p className="text-sm text-muted-foreground mt-1">Enter the 6-character code shown on the projector.</p>
                </div>
                <Input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && lookupCode()}
                  placeholder="ABCDEF"
                  className="text-center text-3xl font-mono tracking-[0.4em] h-16"
                  maxLength={6}
                />
                {error && <div className="text-sm text-red-600">{error}</div>}
                <Button className="w-full h-12 text-base" onClick={lookupCode} disabled={loading || code.length < 4}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 'event-found' && event && club && (
            <Card className="shadow-xl">
              <CardContent className="p-8 space-y-4">
                <div className="text-center">
                  <div className="inline-block px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: club.primaryColor + '20', color: club.primaryColor }}>
                    {club.name}
                  </div>
                  <h1 className="text-2xl font-bold mt-3">{event.title}</h1>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {new Date(event.startTime).toLocaleString()}</div>
                  {event.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {event.location}</div>}
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {event.checkedIn} checked in {event.capacity && `/ ${event.capacity} capacity`}</div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div className="text-sm font-medium text-center">Enter your school email to check in</div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      autoFocus
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && checkIn()}
                      placeholder="firstname.lastname@student.school.edu"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Name (optional)</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-detected from email" />
                  </div>
                  {error && <div className="text-sm text-red-600">{error}</div>}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={reset}>Back</Button>
                    <Button className="flex-1" onClick={checkIn} disabled={loading || !email.includes('@')}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Check in
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'success' && result && (
            <Card className="shadow-xl border-emerald-500">
              <CardContent className="p-8 space-y-4 text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">You're checked in!</h1>
                  <p className="text-lg mt-1">{result.user.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{result.event.title}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-4">
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-emerald-600">+{result.points}</div>
                    <div className="text-xs text-muted-foreground">points</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-emerald-600">{result.streak}</div>
                    <div className="text-xs text-muted-foreground">streak</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-emerald-600 capitalize">{result.status}</div>
                    <div className="text-xs text-muted-foreground">status</div>
                  </div>
                </div>
                <Button className="w-full" onClick={reset}>Check in another student</Button>
              </CardContent>
            </Card>
          )}

          {step === 'already' && result && (
            <Card className="shadow-xl border-amber-500">
              <CardContent className="p-8 space-y-4 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Already checked in</h1>
                  <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                </div>
                <Button className="w-full" onClick={reset}>Check in a different student</Button>
              </CardContent>
            </Card>
          )}

          {step === 'error' && (
            <Card className="shadow-xl border-red-500">
              <CardContent className="p-8 space-y-4 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Check-in failed</h1>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
                <Button className="w-full" onClick={reset}>Try again</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
