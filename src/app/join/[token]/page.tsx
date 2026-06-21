'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { School, Loader2, CheckCircle2, AlertCircle, PartyPopper } from 'lucide-react'
import { AuthAwareLink } from '@/components/clubhub/auth-aware-link'

export default function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [clubName, setClubName] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', grade: '', studentId: '', phone: '' })

  async function fetchInvite() {
    setStatus('loading')
    // We use the accept endpoint with a no-op body to peek at the invite first.
    // To keep it simple, we just submit and rely on the response to tell us what happened.
  }

  async function acceptInvite() {
    setStatus('loading')
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      })
      const data = await res.json()
      if (res.ok) {
        setClubName(data.club?.name || 'your club')
        setStatus('success')
      } else {
        setStatus('error')
        setError(data.error || 'Failed to accept invite')
      }
    } catch (e: any) {
      setStatus('error')
      setError(e.message)
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-lg">
          <CardHeader>
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
              <PartyPopper className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle>Welcome to {clubName}!</CardTitle>
            <CardDescription>You're officially a member.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You should receive a welcome email shortly. Open your dashboard to see your new club.
            </p>
            {/* AuthAwareLink: signed-in users (who just accepted the invite)
                go straight to their dashboard; signed-out users go through
                /login first. Previously this hard-coded /login, which sent
                an already-authenticated user to the login form. */}
            <AuthAwareLink href="/app" className="block">
              <Button className="w-full">Go to Dashboard</Button>
            </AuthAwareLink>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
            <School className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xl font-bold">Roster</div>
            <div className="text-xs text-muted-foreground">You've been invited!</div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Accept your invite</CardTitle>
            <CardDescription>Fill in a few details to complete your membership.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  placeholder="9-12"
                  type="number"
                  min={9}
                  max={12}
                />
              </div>
              <div className="space-y-2">
                <Label>Student ID</Label>
                <Input
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  placeholder="optional"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="for SMS reminders"
              />
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              className="w-full"
              onClick={acceptInvite}
              disabled={!form.name || status === 'loading'}
            >
              {status === 'loading' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Accepting…</> : 'Accept invite & join'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
