'use client'

import { useState, useEffect } from 'react'
import { useFetch, apiPost, apiPatch, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
 Settings as SettingsIcon, Sliders, Shield, Bell, Palette, Plus, Trash2, Pencil,
 QrCode, Monitor, Smartphone, MapPin, Camera, Trophy, Flame, Users, Calendar,
 Mail, MessageSquare, Clock, CheckCircle2, Webhook, Code, Plug, Boxes, Check, Loader2
} from 'lucide-react'
import { FIELD_TYPES, type CustomField } from '@/lib/clubhub/types'
import { toast } from 'sonner'
import { MODULES, CORE_MODULES, getModulesByGroup, parseModules, type ModuleId } from '@/lib/clubhub/modules'

export function SettingsTab({ clubId, clubIdForced }: { clubId: string, clubIdForced?: string }) {
 if (clubId === 'ALL' && !clubIdForced) {
 return (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <SettingsIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
 <p>Select a specific club to configure its settings.</p>
 </CardContent></Card>
 )
 }

 const effectiveClubId = clubIdForced || clubId

 return (
 <Tabs defaultValue="general" className="space-y-4">
 <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 max-w-3xl">
 <TabsTrigger value="general"><Sliders className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="modules"><Boxes className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="attendance"><QrCode className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="custom-fields"><Code className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="integrations"><Plug className="h-3.5 w-3.5" /></TabsTrigger>
 <TabsTrigger value="danger"><Shield className="h-3.5 w-3.5" /></TabsTrigger>
 </TabsList>

 <TabsContent value="general"><GeneralSettings clubId={effectiveClubId} /></TabsContent>
 <TabsContent value="modules"><ModulesSettings clubId={effectiveClubId} /></TabsContent>
 <TabsContent value="attendance"><AttendanceSettings clubId={effectiveClubId} /></TabsContent>
 <TabsContent value="custom-fields"><CustomFieldsManager clubId={effectiveClubId} /></TabsContent>
 <TabsContent value="integrations"><IntegrationsSettings clubId={effectiveClubId} /></TabsContent>
 <TabsContent value="danger"><DangerZone clubId={effectiveClubId} /></TabsContent>
 </Tabs>
 )
}

function GeneralSettings({ clubId }: { clubId: string }) {
 const { data, loading, refetch } = useFetch<{ settings: any }>(`/api/settings?clubId=${clubId}`)
 const [form, setForm] = useState<any>(null)

 // Sync form to data when it loads (and if it ever changes).
 // Previously this used a render-phase `setTimeout(() => setForm(...), 0)`
 // which fired on every render while data was set and form was null —
 // and never refired if settings were refetched.
 useEffect(() => {
 // eslint-disable-next-line react-hooks/set-state-in-effect
 if (data?.settings) setForm(data.settings)
 }, [data?.settings])

 const update = async (updates: any) => {
 try {
 const { settings } = await apiPatch('/api/settings', { clubId, ...updates })
 setForm(settings)
 toast.success('Settings saved')
 refetch()
 } catch (e: any) { if (!e?.silent) toast.error(e.message) }
 }

 if (loading || !form) return <Skeleton className="h-96 w-full" />

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Gamification</CardTitle>
 <CardDescription>Engage members with points, streaks, and leaderboards.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <SettingToggle
 label="Enable Gamification"
 description="Award points for attendance and achievements"
 icon={<Trophy className="h-4 w-4" />}
 checked={form.enableGamification}
 onChange={(v) => update({ enableGamification: v })}
 />
 <SettingToggle
 label="Enable Streaks"
 description="Track consecutive meeting attendance"
 icon={<Flame className="h-4 w-4" />}
 checked={form.enableStreaks}
 onChange={(v) => update({ enableStreaks: v })}
 />
 <SettingToggle
 label="Enable Leaderboard"
 description="Show member rankings based on points"
 icon={<Users className="h-4 w-4" />}
 checked={form.enableLeaderboard}
 onChange={(v) => update({ enableLeaderboard: v })}
 />
 <SettingToggle
 label="Track Volunteer Hours"
 description="Allow members to log community service hours"
 icon={<Calendar className="h-4 w-4" />}
 checked={form.enableVolunteerHours}
 onChange={(v) => update({ enableVolunteerHours: v })}
 />
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
 <CardDescription>Configure how and when members are reminded about events.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <SettingToggle
 label="Email Reminders"
 description="Send email reminders before events"
 icon={<Mail className="h-4 w-4" />}
 checked={form.emailRemindersEnabled}
 onChange={(v) => update({ emailRemindersEnabled: v })}
 />
 <SettingToggle
 label="SMS Reminders"
 description="Send SMS reminders (carrier fees may apply)"
 icon={<MessageSquare className="h-4 w-4" />}
 checked={form.smsRemindersEnabled}
 onChange={(v) => update({ smsRemindersEnabled: v })}
 />
 <div className="flex items-center justify-between p-3 rounded-lg border">
 <div className="flex items-center gap-3">
 <Clock className="h-4 w-4 text-muted-foreground" />
 <div>
 <div className="text-sm font-medium">Reminder Lead Time</div>
 <div className="text-xs text-muted-foreground">Hours before event to send reminder</div>
 </div>
 </div>
 <Input
 type="number"
 value={form.reminderHoursBefore}
 onChange={(e) => update({ reminderHoursBefore: parseInt(e.target.value) || 24 })}
 className="w-20"
 />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Parent Portal</CardTitle>
 <CardDescription>Let parents view their child's attendance and excuse absences.</CardDescription>
 </CardHeader>
 <CardContent>
 <SettingToggle
 label="Enable Parent Portal"
 description="Parents can view attendance and excuse absences"
 icon={<Shield className="h-4 w-4" />}
 checked={form.enableParentPortal}
 onChange={(v) => update({ enableParentPortal: v })}
 />
 <SettingToggle
 label="Require Excuse Notes"
 description="Members must provide a reason when excused"
 icon={<CheckCircle2 className="h-4 w-4" />}
 checked={form.requireExcuseNote}
 onChange={(v) => update({ requireExcuseNote: v })}
 />
 </CardContent>
 </Card>
 </div>
 )
}

function ModulesSettings({ clubId }: { clubId: string }) {
  // Fetch the club itself so we can read its current modules config.
  const { data, loading, refetch } = useFetch<{ club: any }>(`/api/clubs/${clubId}`)
  const club = data?.club
  const rawModules: string | null = club?.modules ?? null
  // null = legacy club, all on. For the UI we treat that as "all enabled".
  const parsed = parseModules(rawModules)
  const enabledSet: Set<ModuleId> = new Set(parsed ?? MODULES.map((m) => m.id))
  const isLegacy = parsed === null

  const [saving, setSaving] = useState(false)

  const toggle = async (id: ModuleId) => {
    // Core 3 can't be unchecked.
    if (CORE_MODULES.includes(id)) {
      toast.error('The core modules (Members, Attendance, Events) are always on — they\'re the definition of a club.')
      return
    }
    const next = new Set(enabledSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSaving(true)
    try {
      await apiPatch(`/api/clubs/${clubId}`, { modules: Array.from(next) })
      toast.success(next.has(id) ? `Enabled ${id}.` : `Disabled ${id}.`)
      refetch()
    } catch (e: any) {
      if (!e?.silent) toast.error(e?.message ?? 'Could not update modules.')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !club) {
    return (
      <Card><CardContent className="py-10 flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading modules…
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header — explains the philosophy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Boxes className="h-4 w-4" /> Modules</CardTitle>
          <CardDescription>
            Pick what this club actually needs. Toggling a module off hides its tab from the sidebar
            and blocks its API routes — it does not delete the underlying data. The three core modules
            are always on because they&apos;re the literal definition of a club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">{enabledSet.size}</span> of {MODULES.length} modules enabled.
            {isLegacy && (
              <span className="ml-2 label-mono text-xs">(legacy mode — all modules on. Toggle any module off to switch to explicit mode.)</span>
            )}
            {saving && <span className="ml-2 text-xs">Saving…</span>}
          </div>
        </CardContent>
      </Card>

      {/* The picker — grouped, same UI as onboarding */}
      <div className="space-y-5">
        {Object.entries(getModulesByGroup()).map(([group, mods]) => {
          if (!mods.length) return null
          return (
            <div key={group}>
              <div className="label-mono text-xs text-muted-foreground mb-2 px-1">{group}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border border border-border">
                {mods.map((m) => {
                  const checked = enabledSet.has(m.id)
                  const locked = CORE_MODULES.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      disabled={locked || saving}
                      className={`text-left p-4 bg-background transition-colors ${
                        locked ? 'cursor-default' : 'hover:bg-muted/50'
                      } ${saving ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
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
  )
}

function AttendanceSettings({ clubId }: { clubId: string }) {
 const { data, loading, refetch } = useFetch<{ settings: any }>(`/api/settings?clubId=${clubId}`)
 const [form, setForm] = useState<any>(null)
 useEffect(() => {
 // eslint-disable-next-line react-hooks/set-state-in-effect
 if (data?.settings) setForm(data.settings)
 }, [data?.settings])

 const update = async (updates: any) => {
 try {
 const { settings } = await apiPatch('/api/settings', { clubId, ...updates })
 setForm(settings)
 toast.success('Settings saved')
 refetch()
 } catch (e: any) { if (!e?.silent) toast.error(e.message) }
 }

 if (loading || !form) return <Skeleton className="h-96 w-full" />

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Check-In Methods</CardTitle>
 <CardDescription>Choose how members can check in to events.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <SettingToggle label="QR Code Check-In" description="Generate QR codes for members to scan" icon={<QrCode className="h-4 w-4" />} checked={form.enableQrCheckin} onChange={(v) => update({ enableQrCheckin: v })} />
 <SettingToggle label="Kiosk Mode" description="Display a kiosk for student ID entry at the door" icon={<Monitor className="h-4 w-4" />} checked={form.enableKioskMode} onChange={(v) => update({ enableKioskMode: v })} />
 <SettingToggle label="Self Check-In" description="Members check themselves in via phone" icon={<Smartphone className="h-4 w-4" />} checked={form.enableSelfCheckin} onChange={(v) => update({ enableSelfCheckin: v })} />
 <SettingToggle label="Geofenced Check-In" description="Only allow check-in within event location radius" icon={<MapPin className="h-4 w-4" />} checked={form.enableGeofencing} onChange={(v) => update({ enableGeofencing: v })} />
 <SettingToggle label="Selfie Verification" description="Require photo proof at check-in" icon={<Camera className="h-4 w-4" />} checked={form.enableSelfieVerify} onChange={(v) => update({ enableSelfieVerify: v })} />
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Attendance Windows</CardTitle>
 <CardDescription>Control when members can check in and out.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex items-center justify-between p-3 rounded-lg border">
 <div>
 <div className="text-sm font-medium">Early Check-In Window</div>
 <div className="text-xs text-muted-foreground">Minutes before event start</div>
 </div>
 <Input type="number" value={form.attendanceWindowBefore} onChange={(e) => update({ attendanceWindowBefore: parseInt(e.target.value) || 0 })} className="w-20" />
 </div>
 <div className="flex items-center justify-between p-3 rounded-lg border">
 <div>
 <div className="text-sm font-medium">Late Check-In Window</div>
 <div className="text-xs text-muted-foreground">Minutes after event start</div>
 </div>
 <Input type="number" value={form.attendanceWindowAfter} onChange={(e) => update({ attendanceWindowAfter: parseInt(e.target.value) || 0 })} className="w-20" />
 </div>
 </div>
 <SettingToggle
 label="Auto-Mark No-Shows"
 description="Automatically mark absent members as no-shows after threshold"
 icon={<Clock className="h-4 w-4" />}
 checked={form.autoMarkNoShow}
 onChange={(v) => update({ autoMarkNoShow: v })}
 />
 <div className="flex items-center justify-between p-3 rounded-lg border">
 <div>
 <div className="text-sm font-medium">No-Show Threshold</div>
 <div className="text-xs text-muted-foreground">Minutes late before marking as no-show</div>
 </div>
 <Input type="number" value={form.noShowThresholdMinutes} onChange={(e) => update({ noShowThresholdMinutes: parseInt(e.target.value) || 15 })} className="w-20" />
 </div>
 <div className="flex items-center justify-between p-3 rounded-lg border">
 <div>
 <div className="text-sm font-medium">Default Attendance Status</div>
 <div className="text-xs text-muted-foreground">Initial status when a member is added to an event</div>
 </div>
 <Select value={form.defaultAttendanceStatus} onValueChange={(v) => update({ defaultAttendanceStatus: v })}>
 <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="PENDING">Pending</SelectItem>
 <SelectItem value="PRESENT">Present</SelectItem>
 <SelectItem value="ABSENT">Absent</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>
 </div>
 )
}

function CustomFieldsManager({ clubId }: { clubId: string }) {
 const { data, loading, refetch } = useFetch<{ fields: CustomField[] }>(`/api/custom-fields?clubId=${clubId}`)
 const [createOpen, setCreateOpen] = useState(false)
 const [editField, setEditField] = useState<CustomField | null>(null)

 const fields = data?.fields || []

 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="flex items-center gap-2"><Code className="h-5 w-5" /> Custom Fields</CardTitle>
 <CardDescription>Build custom fields to capture anything you need — T-shirt sizes, emergency contacts, instrument, math class, you name it.</CardDescription>
 </div>
 <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add Field</Button>
 </div>
 </CardHeader>
 <CardContent>
 {loading ? (
 <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
 ) : fields.length === 0 ? (
 <div className="text-center text-sm text-muted-foreground py-8">
 No custom fields yet. Add one to capture more data from your members!
 </div>
 ) : (
 <div className="space-y-2">
 {fields.map(f => (
 <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30">
 <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted text-sm font-mono">
 {FIELD_TYPES.find(t => t.value === f.type)?.icon || '?'}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-sm">{f.label}</span>
 {f.required && <Badge variant="destructive" className="text-[10px]">Required</Badge>}
 {!f.isVisible && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
 </div>
 <div className="text-xs text-muted-foreground">
 {f.name} · {f.type.replace(/_/g, ' ').toLowerCase()}
 {(() => {
 try {
 if (!f.options) return ''
 const parsed = JSON.parse(f.options)
 return ` · ${Array.isArray(parsed) ? parsed.length : 0} options`
 } catch {
 return ''
 }
 })()}
 </div>
 </div>
 <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditField(f)}>
 <Pencil className="h-3.5 w-3.5" />
 </Button>
 <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-foreground" onClick={async () => {
 if (!confirm(`Delete field"${f.label}"?`)) return
 try {
 await apiDelete(`/api/custom-fields?id=${f.id}`)
 toast.success('Field deleted')
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 <CustomFieldDialog
 open={createOpen}
 onOpenChange={setCreateOpen}
 clubId={clubId}
 onSaved={() => { refetch(); setCreateOpen(false) }}
 />
 <CustomFieldDialog
 open={!!editField}
 onOpenChange={(o) => !o && setEditField(null)}
 clubId={clubId}
 field={editField}
 onSaved={() => { refetch(); setEditField(null) }}
 />
 </div>
 )
}

function CustomFieldDialog({ open, onOpenChange, clubId, field, onSaved }: {
 open: boolean
 onOpenChange: (o: boolean) => void
 clubId: string
 field?: CustomField | null
 onSaved: () => void
}) {
 const initialForm = {
 name: '', label: '', type: 'TEXT', options: '', required: false, description: '',
 sortOrder: 0, isVisible: true, isEditable: true, appliesTo: 'member'
 }
 const [form, setForm] = useState<any>(field ? {
 ...field,
 options: field.options ? JSON.parse(field.options).join(', ') : ''
 } : { ...initialForm })

 // Reset when the `field` prop changes (e.g. opening the edit dialog for
 // a different field). The original code used `useState(() => …)`, a lazy
 // initializer that only fires once on mount — so the dialog never
 // re-populated when the field prop changed.
 useEffect(() => {
 if (field) {
 // eslint-disable-next-line react-hooks/set-state-in-effect
 setForm({ ...field, options: field.options ? JSON.parse(field.options).join(', ') : '' })
 }
 }, [field])

 const handleSave = async () => {
 if (!form.name || !form.label) {
 toast.error('Name and label required')
 return
 }
 const payload: any = {
 ...form,
 clubId,
 options: form.options ? form.options.split(',').map((s: string) => s.trim()).filter(Boolean) : null,
 }
 try {
 if (field) {
 payload.id = field.id
 await apiPatch('/api/custom-fields', payload)
 toast.success('Field updated')
 } else {
 await apiPost('/api/custom-fields', payload)
 toast.success('Field created')
 }
 onSaved()
 } catch (e: any) { if (!e?.silent) toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{field ? 'Edit' : 'Create'} Custom Field</DialogTitle>
 <DialogDescription>Custom fields can capture any data you need from your members.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Field Name (key)</Label>
 <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., tshirt_size" disabled={!!field} />
 </div>
 <div>
 <Label>Display Label</Label>
 <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g., T-Shirt Size" />
 </div>
 </div>
 <div>
 <Label>Field Type</Label>
 <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 {['SELECT', 'MULTISELECT', 'RADIO', 'CHECKBOX', 'TSHIRT_SIZE'].includes(form.type) && (
 <div>
 <Label>Options (comma-separated)</Label>
 <Input value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} placeholder="XS, S, M, L, XL" />
 </div>
 )}
 <div>
 <Label>Description (optional)</Label>
 <Input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Help text shown to members" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <Label>Applies To</Label>
 <Select value={form.appliesTo} onValueChange={v => setForm({ ...form, appliesTo: v })}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="member">Member</SelectItem>
 <SelectItem value="event">Event</SelectItem>
 <SelectItem value="attendance">Attendance</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label>Sort Order</Label>
 <Input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
 </div>
 </div>
 <div className="grid grid-cols-3 gap-2 pt-2">
 <div className="flex items-center gap-2">
 <Switch checked={form.required} onCheckedChange={v => setForm({ ...form, required: v })} id="req" />
 <Label htmlFor="req" className="text-sm">Required</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch checked={form.isVisible} onCheckedChange={v => setForm({ ...form, isVisible: v })} id="vis" />
 <Label htmlFor="vis" className="text-sm">Visible</Label>
 </div>
 <div className="flex items-center gap-2">
 <Switch checked={form.isEditable} onCheckedChange={v => setForm({ ...form, isEditable: v })} id="edit" />
 <Label htmlFor="edit" className="text-sm">Editable</Label>
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={handleSave}>{field ? 'Save' : 'Create'} Field</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

function IntegrationsSettings({ clubId }: { clubId: string }) {
 return (
 <div className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Plug className="h-5 w-5" /> Integrations</CardTitle>
 <CardDescription>Connect Roster with other tools your school uses.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {[
 { name: 'Google Calendar', desc: 'Sync events to Google Calendar (iCal feed)', icon: '📅', enabled: true },
 { name: 'Slack', desc: 'Send announcements to a Slack channel', icon: '💬', enabled: false },
 { name: 'Discord', desc: 'Bot integration for club Discord servers', icon: '🎮', enabled: false },
 { name: 'Email (SMTP)', desc: 'Custom email server for announcements', icon: '✉️', enabled: true },
 { name: 'Twilio SMS', desc: 'SMS reminders via Twilio', icon: '📱', enabled: false },
 { name: 'Webhooks', desc: 'Fire HTTP webhooks on attendance events', icon: '🔗', enabled: false },
 { name: 'Zapier', desc: 'Connect to 5,000+ apps via Zapier', icon: '⚡', enabled: false },
 { name: 'REST API', desc: 'Programmatic access to all data', icon: '🔧', enabled: true },
 { name: 'Single Sign-On (SAML)', desc: 'School district SSO integration', icon: '🔐', enabled: false },
 { name: 'PowerSchool Sync', desc: 'Sync student roster from PowerSchool', icon: '🎒', enabled: false },
 ].map(int => (
 <div key={int.name} className="flex items-center gap-3 p-3 rounded-lg border">
 <div className="text-2xl">{int.icon}</div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-sm">{int.name}</span>
 {int.enabled && <Badge variant="default" className="text-[10px] bg-foreground">Enabled</Badge>}
 </div>
 <div className="text-xs text-muted-foreground">{int.desc}</div>
 </div>
 <Button size="sm" variant={int.enabled ? 'outline' : 'default'}>
 {int.enabled ? 'Configure' : 'Connect'}
 </Button>
 </div>
 ))}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhook Events</CardTitle>
 <CardDescription>Subscribe to real-time events from Roster.</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
 {[
 'member.joined', 'member.left', 'event.created', 'event.cancelled',
 'attendance.checked_in', 'attendance.marked', 'badge.awarded',
 'announcement.posted', 'streak.milestone', 'member.at_risk'
 ].map(evt => (
 <div key={evt} className="flex items-center gap-2 p-2 rounded border font-mono text-xs">
 <Webhook className="h-3 w-3 text-muted-foreground" />
 {evt}
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>
 )
}

function DangerZone({ clubId }: { clubId: string }) {
 return (
 <Card className="border-foreground/30">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-foreground"><Shield className="h-5 w-5" /> Danger Zone</CardTitle>
 <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center justify-between p-3 rounded-lg border border-foreground/20">
 <div>
 <div className="font-medium text-sm">Reset All Attendance</div>
 <div className="text-xs text-muted-foreground">Clear all attendance records for this club</div>
 </div>
 <Button variant="outline" className="text-foreground border-foreground/30" onClick={() => toast.error('This is a demo — disabled for safety')}>
 Reset
 </Button>
 </div>
 <div className="flex items-center justify-between p-3 rounded-lg border border-foreground/20">
 <div>
 <div className="font-medium text-sm">Archive Club</div>
 <div className="text-xs text-muted-foreground">Mark club as inactive (reversible)</div>
 </div>
 <Button variant="outline" className="text-foreground border-foreground/30" onClick={() => toast.error('This is a demo — disabled for safety')}>
 Archive
 </Button>
 </div>
 <div className="flex items-center justify-between p-3 rounded-lg border border-foreground/40 bg-muted">
 <div>
 <div className="font-medium text-sm">Delete Club Permanently</div>
 <div className="text-xs text-muted-foreground">Remove club and all related data forever</div>
 </div>
 <Button variant="destructive" onClick={() => toast.error('This is a demo — disabled for safety')}>
 <Trash2 className="h-4 w-4 mr-1" /> Delete
 </Button>
 </div>
 </CardContent>
 </Card>
 )
}

function SettingToggle({ label, description, icon, checked, onChange }: {
 label: string
 description: string
 icon: React.ReactNode
 checked: boolean
 onChange: (v: boolean) => void
}) {
 return (
 <div className="flex items-center justify-between p-3 rounded-lg border">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
 {icon}
 </div>
 <div>
 <div className="text-sm font-medium">{label}</div>
 <div className="text-xs text-muted-foreground">{description}</div>
 </div>
 </div>
 <Switch checked={checked} onCheckedChange={onChange} />
 </div>
 )
}
