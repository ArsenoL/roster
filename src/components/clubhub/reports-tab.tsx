'use client'

import { useState } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, Download, Printer, FileBarChart, FileSpreadsheet, FileUser, Award, Calendar, DollarSign, Users } from 'lucide-react'
import { toast } from 'sonner'

const REPORT_TYPES = [
 { value: 'attendance', label: 'Attendance Report', icon: Calendar, description: 'Full attendance history for all events and members', color: 'bg-foreground dark:bg-blue-950/30 text-foreground' },
 { value: 'roster', label: 'Member Roster', icon: Users, description: 'Complete contact directory of active members', color: 'bg-foreground dark:bg-emerald-950/30 text-foreground' },
 { value: 'finance', label: 'Finance Report', icon: DollarSign, description: 'All income and expenses with running balance', color: 'bg-foreground dark:bg-amber-950/30 text-foreground' },
 { value: 'service-letter', label: 'Service Letter', icon: Award, description: 'Official service hour letter for a single member', color: 'bg-foreground dark:bg-purple-950/30 text-foreground' },
 { value: 'member-summary', label: 'Member Profile Report', icon: FileUser, description: 'Complete dossier for a single member', color: 'bg-foreground dark:bg-pink-950/30 text-foreground' },
]

export function ReportsTab({ clubId }: { clubId: string }) {
 const [viewing, setViewing] = useState<string | null>(null)
 const [memberId, setMemberId] = useState<string>('')

 const { data: membersData } = useFetch<{ members: any[] }>(clubId !== 'ALL' ? `/api/members?clubId=${clubId}` : '/api/members')

 return (
 <div className="space-y-4">
 <Card className="bg-muted border-foreground/20">
 <CardContent className="p-4">
 <div className="flex items-start gap-3">
 <FileBarChart className="h-8 w-8 text-foreground shrink-0" />
 <div>
 <div className="font-semibold">Reports & Exports</div>
 <div className="text-sm text-muted-foreground">
 Generate printable PDF reports for college applications, school administration, club archives, and audits. All reports can be saved as PDF via your browser's print dialog.
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {clubId === 'ALL' ? (
 <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">
 Please select a specific club to generate reports.
 </CardContent></Card>
 ) : (
 <>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {REPORT_TYPES.map(rt => {
 const Icon = rt.icon
 const needsMember = rt.value === 'service-letter' || rt.value === 'member-summary'
 return (
 <Card key={rt.value} className="hover:transition-shadow">
 <CardHeader>
 <div className="flex items-start justify-between">
 <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rt.color}`}><Icon className="h-5 w-5" /></div>
 {needsMember && <Badge variant="outline" className="text-[10px]">Member required</Badge>}
 </div>
 <CardTitle className="text-base mt-1">{rt.label}</CardTitle>
 <CardDescription>{rt.description}</CardDescription>
 </CardHeader>
 <CardContent>
 {needsMember ? (
 <div className="space-y-2">
 <Select value={memberId} onValueChange={setMemberId}>
 <SelectTrigger><SelectValue placeholder="Select member..." /></SelectTrigger>
 <SelectContent>{(membersData?.members || []).map((m: any) => <SelectItem key={m.userId} value={m.userId}>{m.user.name}</SelectItem>)}</SelectContent>
 </Select>
 <Button className="w-full" disabled={!memberId} onClick={() => setViewing(`${rt.value}?userId=${memberId}`)}>
 <Printer className="h-4 w-4 mr-1" /> Generate
 </Button>
 </div>
 ) : (
 <Button className="w-full" onClick={() => setViewing(rt.value)}>
 <Printer className="h-4 w-4 mr-1" /> Generate Report
 </Button>
 )}
 </CardContent>
 </Card>
 )
 })}
 </div>
 </>
 )}

 {viewing && <ReportViewer type={viewing} clubId={clubId} onClose={() => setViewing(null)} />}
 </div>
 )
}

function ReportViewer({ type, clubId, onClose }: any) {
 const url = `/api/reports?type=${type}&clubId=${clubId}`
 const { data, loading } = useFetch<any>(url)

 if (loading) return <Dialog open onOpenChange={onClose}><DialogContent className="max-w-3xl"><Skeleton className="h-96 w-full" /></DialogContent></Dialog>

 const report = data
 if (!report) return null

 const club = report.club
 const generatedAt = new Date(report.generatedAt).toLocaleString()

 return (
 <Dialog open onOpenChange={onClose}>
 <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center justify-between">
 <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> {REPORT_TYPES.find(r => type.startsWith(r.value))?.label}</span>
 <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3 w-3 mr-1" /> Print / Save PDF</Button>
 </DialogTitle>
 </DialogHeader>

 <div className="space-y-4 font-serif">
 {/* Header */}
 <div className="border-b pb-3 text-center">
 <div className="text-2xl font-bold">{club.name}</div>
 <div className="text-sm text-muted-foreground">{club.category} Club{club.foundedYear ? ` · Founded ${club.foundedYear}` : ''}</div>
 {club.advisor && <div className="text-xs text-muted-foreground mt-1">Advisor: {club.advisor.name} ({club.advisor.email})</div>}
 <div className="text-xs text-muted-foreground mt-2">Generated: {generatedAt}</div>
 </div>

 {/* Report body */}
 {report.type === 'attendance' && <AttendanceReport report={report} />}
 {report.type === 'roster' && <RosterReport report={report} />}
 {report.type === 'finance' && <FinanceReport report={report} />}
 {report.type === 'service-letter' && <ServiceLetter report={report} />}
 {report.type === 'member-summary' && <MemberSummary report={report} />}
 </div>
 </DialogContent>
 </Dialog>
 )
}

function AttendanceReport({ report }: any) {
 return (
 <div>
 <h3 className="font-bold mb-2">Attendance History</h3>
 <div className="space-y-3 text-sm">
 {report.events.map((e: any) => (
 <div key={e.id} className="border-b pb-2">
 <div className="font-medium">{e.title} — {new Date(e.startTime).toLocaleDateString()}</div>
 <div className="text-xs text-muted-foreground mb-1">{e.type} · {e.location || 'No location'}</div>
 <div className="text-xs">
 {e.attendances.map((a: any) => (
 <span key={a.id} className="inline-block mr-2 mb-1 px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--color)' }}>
 {a.user.name}: {a.status}
 </span>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}

function RosterReport({ report }: any) {
 return (
 <div>
 <h3 className="font-bold mb-2">Member Roster ({report.members.length})</h3>
 <table className="w-full text-sm">
 <thead className="border-b">
 <tr><th className="text-left p-1">Name</th><th className="text-left p-1">Role</th><th className="text-left p-1">Email</th><th className="text-left p-1">Grade</th><th className="text-left p-1">Phone</th></tr>
 </thead>
 <tbody>
 {report.members.map((m: any) => (
 <tr key={m.id} className="border-b">
 <td className="p-1">{m.user.name}</td>
 <td className="p-1">{m.role}</td>
 <td className="p-1">{m.user.email}</td>
 <td className="p-1">{m.user.grade || '-'}</td>
 <td className="p-1">{m.user.phone || '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )
}

function FinanceReport({ report }: any) {
 return (
 <div>
 <h3 className="font-bold mb-2">Financial Summary</h3>
 <div className="grid grid-cols-3 gap-2 mb-4 text-center">
 <div className="border rounded p-2"><div className="text-xs">Income</div><div className="font-bold text-foreground">${report.summary.income.toFixed(2)}</div></div>
 <div className="border rounded p-2"><div className="text-xs">Expenses</div><div className="font-bold text-foreground">${report.summary.expenses.toFixed(2)}</div></div>
 <div className="border rounded p-2"><div className="text-xs">Balance</div><div className="font-bold">${report.summary.balance.toFixed(2)}</div></div>
 </div>
 <table className="w-full text-sm">
 <thead className="border-b"><tr><th className="text-left p-1">Date</th><th className="text-left p-1">Description</th><th className="text-left p-1">Category</th><th className="text-right p-1">Amount</th></tr></thead>
 <tbody>
 {report.transactions.map((t: any) => (
 <tr key={t.id} className="border-b">
 <td className="p-1">{new Date(t.date).toLocaleDateString()}</td>
 <td className="p-1">{t.description || t.category}</td>
 <td className="p-1">{t.category}</td>
 <td className={`p-1 text-right ${t.type === 'EXPENSE' || t.type === 'REFUND' ? 'text-foreground' : 'text-foreground'}`}>
 {t.type === 'EXPENSE' || t.type === 'REFUND' ? '-' : '+'}${t.amount.toFixed(2)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )
}

function ServiceLetter({ report }: any) {
 const { club, user, hours, totalHours, memberSince, role } = report
 return (
 <div className="text-sm leading-relaxed">
 <p className="mb-4">{new Date().toLocaleDateString()}</p>
 <p className="mb-4">To Whom It May Concern,</p>
 <p className="mb-4">This letter is to certify that <strong>{user.name}</strong> has completed <strong>{totalHours} hour(s)</strong> of volunteer service through <strong>{club.name}</strong>{club.advisor ? ` under the supervision of ${club.advisor.name}` : ''}.</p>
 <p className="mb-4">{user.name} has been an active member of {club.name} since {memberSince ? new Date(memberSince).toLocaleDateString() : 'their joining'}, serving in the role of {role || 'Member'}, and has demonstrated dedication, leadership, and a strong commitment to serving our community.</p>
 <p className="mb-2">Below is a summary of the verified service hours completed:</p>
 <ul className="list-disc pl-6 mb-4 space-y-1">
 {hours.map((h: any) => (
 <li key={h.id}>{new Date(h.date).toLocaleDateString()} — <strong>{h.hours}h</strong> — {h.description}{h.organization ? ` (${h.organization})` : ''}</li>
 ))}
 </ul>
 <p className="mb-4"><strong>Total Verified Hours: {totalHours}</strong></p>
 <p className="mb-4">If you have any questions, please do not hesitate to contact me.</p>
 <p className="mb-1">Sincerely,</p>
 <p className="mb-1"><strong>{club.advisor?.name || '_______________'}</strong></p>
 <p>{club.advisor ? `Advisor, ${club.name}` : ''}</p>
 <p>{club.advisor?.email || ''}</p>
 </div>
 )
}

function MemberSummary({ report }: any) {
 const { user, membership, attendances, badges, hours } = report
 const totalHours = hours.reduce((s: number, h: any) => s + h.hours, 0)
 const present = attendances.filter((a: any) => ['PRESENT', 'LATE', 'VIRTUAL'].includes(a.status)).length
 const rate = attendances.length > 0 ? ((present / attendances.length) * 100).toFixed(0) : '0'

 return (
 <div className="text-sm space-y-4">
 <div>
 <h3 className="font-bold text-base mb-1">{user.name}</h3>
 <div className="text-xs text-muted-foreground">{user.email} · Grade {user.grade || '-'}</div>
 </div>
 <div className="grid grid-cols-3 gap-2 text-center">
 <div className="border rounded p-2"><div className="text-xs">Role</div><div className="font-bold">{membership?.role || 'Member'}</div></div>
 <div className="border rounded p-2"><div className="text-xs">Attendance</div><div className="font-bold">{rate}%</div></div>
 <div className="border rounded p-2"><div className="text-xs">Service Hours</div><div className="font-bold">{totalHours}</div></div>
 </div>
 <div>
 <h4 className="font-semibold mb-1">Badges Earned ({badges.length})</h4>
 {badges.length === 0 ? <p className="text-muted-foreground">No badges yet.</p> : (
 <ul className="list-disc pl-6 space-y-0.5">{badges.map((b: any) => <li key={b.id}>{b.badge.icon} {b.badge.name} — {b.badge.tier}</li>)}</ul>
 )}
 </div>
 <div>
 <h4 className="font-semibold mb-1">Recent Attendance ({attendances.length})</h4>
 <ul className="space-y-0.5 text-xs">{attendances.slice(-10).map((a: any) => (
 <li key={a.id}>{new Date(a.event.startTime).toLocaleDateString()} — {a.event.title}: <strong>{a.status}</strong></li>
 ))}</ul>
 </div>
 </div>
 )
}
