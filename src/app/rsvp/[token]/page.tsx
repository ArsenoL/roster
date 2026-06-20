'use client'

import { use, useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle, Calendar, MapPin, Users, Clock, PartyPopper } from 'lucide-react'

export default function PublicRsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: eventId } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [event, setEvent] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', partySize: 1, notes: '', status: 'GOING' })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/rsvp/public?eventId=${eventId}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json()
          throw new Error(d.error || 'Failed to load event')
        }
        return r.json()
      })
      .then((d) => setEvent(d.event))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [eventId])

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/rsvp/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, ...form }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Couldn't load this event</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-lg">
          <CardContent className="pt-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              {result.status === 'WAITLIST' ? <Users className="h-8 w-8 text-amber-600" /> : <PartyPopper className="h-8 w-8 text-emerald-600" />}
            </div>
            <h2 className="text-lg font-semibold mb-1">
              {result.status === 'WAITLIST' ? `You're #${result.position} on the waitlist` : "You're going!"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {result.status === 'WAITLIST'
                ? "We'll email you if a spot opens up."
                : `See you at ${event.title} on ${new Date(event.startTime).toLocaleString()}.`}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Event hero */}
        <Card className="overflow-hidden mb-4 shadow-lg">
          <div className="h-2" style={{ backgroundColor: event.club.primaryColor }} />
          <CardHeader>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{event.club.name}</div>
            <CardTitle className="text-2xl">{event.title}</CardTitle>
            {event.description && <CardDescription className="text-sm">{event.description}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {new Date(event.startTime).toLocaleString('en', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Until {new Date(event.endTime).toLocaleString('en', { hour: 'numeric', minute: '2-digit' })}
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {event.location}
              </div>
            )}
            {event.capacity && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                {event.rsvpCount}/{event.capacity} going {event.isFull && <span className="text-amber-600 font-medium">(full)</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RSVP form */}
        <Card>
          <CardHeader>
            <CardTitle>RSVP</CardTitle>
            <CardDescription>
              {event.isFull
                ? "This event is at capacity — join the waitlist and we'll notify you if a spot opens."
                : "Let us know if you can make it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" type="email" />
              </div>
            </div>
            <div>
              <Label>Will you attend?</Label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { v: 'GOING', label: event.isFull ? 'Join waitlist' : 'Going' },
                  { v: 'MAYBE', label: 'Maybe' },
                  { v: 'NOT_GOING', label: 'Can\'t make it' },
                ].map((opt) => (
                  <Button
                    key={opt.v}
                    variant={form.status === opt.v ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, status: opt.v })}
                    size="sm"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            {form.status === 'GOING' && !event.isFull && (
              <div>
                <Label>Party size (including you)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: parseInt(e.target.value) || 1 })}
                />
              </div>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything we should know? Dietary restrictions, accessibility needs, etc."
                rows={2}
              />
            </div>
            <Button className="w-full" onClick={submit} disabled={!form.name || !form.email || submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : 'Submit RSVP'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
