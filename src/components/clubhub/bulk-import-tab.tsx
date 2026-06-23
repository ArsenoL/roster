'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/clubhub/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Copy } from 'lucide-react'
import { toast } from 'sonner'

type EntityType = 'members' | 'events' | 'transactions' | 'inventory'

const TEMPLATES: Record<EntityType, string[]> = {
 members: ['name', 'email', 'studentId', 'grade', 'graduationYear', 'house', 'phone', 'role'],
 events: ['title', 'type', 'startTime', 'endTime', 'location', 'capacity', 'isRequired', 'description'],
 transactions: ['type', 'amount', 'category', 'description', 'date'],
 inventory: ['name', 'category', 'quantity', 'condition', 'sku', 'serialNumber', 'purchasePrice', 'location'],
}

const SAMPLE_ROWS: Record<EntityType, string> = {
 members: `name,email,studentId,grade,graduationYear,house,phone,role
Alice Zhang,alice.z@school.edu,12345,10,2027,Pioneer,555-0100,MEMBER
Bob Chen,bob.c@school.edu,12346,11,2026,Explorer,555-0101,COMMITTEE_HEAD
Carol Lee,carol.l@school.edu,12347,12,2025,Pioneer,555-0102,MEMBER`,
 events: `title,type,startTime,endTime,location,capacity,isRequired,description
Weekly Meeting,MEETING,2025-04-01T15:30,2025-04-01T16:30,Room 204,30,true,Regular weekly meeting
Spring Showcase,PERFORMANCE,2025-04-15T19:00,2025-04-15T21:00,Auditorium,200,false,Annual showcase
Field Trip,FIELD_TRIP,2025-04-20T09:00,2025-04-20T17:00,Botanical Gardens,40,true,Educational trip`,
 transactions: `type,amount,category,description,date
INCOME,250,DUES,Spring dues collection,2025-04-01
EXPENSE,75,SUPPLIES,Refreshments for meeting,2025-04-02
EXPENSE,200,EQUIPMENT,New microphone,2025-04-05
INCOME,500,DONATION,Alumni donation,2025-04-10`,
 inventory: `name,category,quantity,condition,sku,serialNumber,purchasePrice,location
Projector,equipment,1,GOOD,PRJ-001,SN12345,450,Storage Closet
Microphone x4,equipment,4,EXCELLENT,MIC-001,SN67890,80 each,AV Cabinet
Robotics Kit,tool,2,NEW,RBK-001,SN11111,250,Lab 3`,
}

export function BulkImportTab({ clubId }: { clubId: string }) {
 const [activeType, setActiveType] = useState<EntityType>('members')
 const [csv, setCsv] = useState(SAMPLE_ROWS.members)
 const [result, setResult] = useState<any>(null)
 const [loading, setLoading] = useState(false)

 function switchType(t: EntityType) {
 setActiveType(t)
 setCsv(SAMPLE_ROWS[t])
 setResult(null)
 }

 function parseCsv(text: string): any[] {
 // RFC 4180–aware parser: handles quoted fields, escaped quotes, and
 // commas embedded inside quoted values.
 const parseCSVLine = (line: string): string[] => {
 const out: string[] = []
 let cur = ''
 let inQuotes = false
 for (let i = 0; i < line.length; i++) {
 const c = line[i]
 if (inQuotes) {
 if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
 else if (c === '"') { inQuotes = false }
 else { cur += c }
 } else {
 if (c === '"') { inQuotes = true }
 else if (c === ',') { out.push(cur); cur = '' }
 else { cur += c }
 }
 }
 out.push(cur)
 return out
 }
 const lines = text.trim().split(/\r?\n/)
 if (lines.length < 2) return []
 const headers = parseCSVLine(lines[0]).map((h) => h.trim())
 return lines.slice(1).map((line) => {
 const values = parseCSVLine(line).map((v) => v.trim())
 const row: any = {}
 headers.forEach((h, i) => { row[h] = values[i] || '' })
 return row
 })
 }

 async function importNow() {
 if (clubId === 'ALL') { toast.error('Select a specific club'); return }
 setLoading(true)
 try {
 const rows = parseCsv(csv)
 if (rows.length === 0) { toast.error('No rows to import'); setLoading(false); return }
 const data = await apiPost('/api/bulk-import', { clubId, type: activeType, rows })
 setResult(data)
 toast.success(`Imported ${data.created} ${activeType}, ${data.existing} existing, ${data.errors} errors`)
 } catch (e: any) { if (!e?.silent) toast.error(e.message) } finally {
 setLoading(false)
 }
 }

 return (
 <div className="space-y-4">
 <div>
 <h2 className="text-lg font-semibold">Bulk Import</h2>
 <p className="text-sm text-muted-foreground">Import members, events, transactions, or inventory in bulk via CSV paste.</p>
 </div>

 <Tabs value={activeType} onValueChange={(v) => switchType(v as EntityType)}>
 <TabsList>
 <TabsTrigger value="members">Members</TabsTrigger>
 <TabsTrigger value="events">Events</TabsTrigger>
 <TabsTrigger value="transactions">Transactions</TabsTrigger>
 <TabsTrigger value="inventory">Inventory</TabsTrigger>
 </TabsList>

 {(['members', 'events', 'transactions', 'inventory'] as EntityType[]).map((t) => (
 <TabsContent key={t} value={t} className="mt-4 space-y-4">
 <Card>
 <CardHeader>
 <CardTitle className="text-base flex items-center gap-2">
 <FileSpreadsheet className="h-4 w-4" /> {t.charAt(0).toUpperCase() + t.slice(1)} CSV format
 </CardTitle>
 <CardDescription>Required columns: {TEMPLATES[t].join(', ')}</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="flex items-center gap-2 flex-wrap">
 {TEMPLATES[t].map((col) => (
 <Badge key={col} variant="outline" className="text-[10px] font-mono">{col}</Badge>
 ))}
 <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(SAMPLE_ROWS[t]); toast.success('Sample CSV copied') }}>
 <Copy className="h-3 w-3 mr-1" /> Copy sample
 </Button>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardContent className="p-4 space-y-3">
 <Label>Paste CSV content</Label>
 <Textarea
 value={csv}
 onChange={(e) => setCsv(e.target.value)}
 rows={10}
 className="font-mono text-xs"
 placeholder={`Paste your CSV here. First line should be headers: ${TEMPLATES[t].join(',')}`}
 />
 <div className="flex items-center justify-between flex-wrap gap-2">
 <p className="text-xs text-muted-foreground">
 {parseCsv(csv).length} row(s) detected
 </p>
 <Button onClick={importNow} disabled={loading || clubId === 'ALL'}>
 {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing…</> : <><UploadCloud className="h-4 w-4 mr-1" /> Import {parseCsv(csv).length} rows</>}
 </Button>
 </div>
 </CardContent>
 </Card>

 {result && (
 <Card className={result.errors > 0 ? 'border-amber-300' : 'border-emerald-300'}>
 <CardContent className="p-4">
 <div className="flex items-center gap-3 mb-3">
 <CheckCircle2 className="h-5 w-5 text-foreground" />
 <h3 className="font-semibold">Import complete</h3>
 </div>
 <div className="grid grid-cols-3 gap-3 mb-3">
 <div className="bg-emerald-100 dark:bg-emerald-950/30 p-3 rounded text-center">
 <div className="text-2xl font-bold text-foreground">{result.created}</div>
 <div className="text-xs text-muted-foreground uppercase">Created</div>
 </div>
 <div className="bg-blue-100 dark:bg-blue-950/30 p-3 rounded text-center">
 <div className="text-2xl font-bold text-foreground">{result.existing}</div>
 <div className="text-xs text-muted-foreground uppercase">Existing</div>
 </div>
 <div className="bg-red-100 dark:bg-red-950/30 p-3 rounded text-center">
 <div className="text-2xl font-bold text-foreground">{result.errors}</div>
 <div className="text-xs text-muted-foreground uppercase">Errors</div>
 </div>
 </div>
 {result.errors > 0 && (
 <div className="space-y-1 max-h-40 overflow-y-auto">
 {result.results.filter((r: any) => r.status === 'error').map((r: any, i: number) => (
 <div key={i} className="text-xs flex items-start gap-2 text-foreground">
 <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
 <span>{r.name || r.title || r.description}: {r.error}</span>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 )}
 </TabsContent>
 ))}
 </Tabs>
 </div>
 )
}
