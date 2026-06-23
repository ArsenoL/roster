'use client'

import { useState, useEffect, useRef } from 'react'
import { useFetch, apiPost } from '@/lib/clubhub/hooks'
import { useAuth } from '@/lib/clubhub/use-auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Send, Plus, MessageSquare, ArrowLeft } from 'lucide-react'
import { avatarColor, initials, timeAgo } from '@/lib/clubhub/types'
import { toast } from 'sonner'

// Use the signed-in user as the "current user" — never impersonate another
// member by reading the first row of /api/members.
function useCurrentUser() {
 const { user, loading } = useAuth()
 return { user, loading }
}

export function MessagesTab({ clubId }: { clubId: string }) {
 const { user: me, loading } = useCurrentUser()
 const url = me ? `/api/messages/conversations?userId=${me.id}` : ''
 const { data, refetch } = useFetch<{ conversations: any[] }>(url)
 const [activeConv, setActiveConv] = useState<string | null>(null)
 const [newConvOpen, setNewConvOpen] = useState(false)

 const conversations = data?.conversations || []

 if (loading || !me) {
 return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
 }

 if (activeConv) {
 return <ConversationView conversationId={activeConv} userId={me.id} onBack={() => { setActiveConv(null); refetch() }} />
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Messages</h2>
 <p className="text-sm text-muted-foreground">Direct messages and group chats within {clubId === 'ALL' ? 'all clubs' : 'this club'}.</p>
 </div>
 <Button onClick={() => setNewConvOpen(true)} disabled={!me}><Plus className="h-4 w-4" /> New chat</Button>
 </div>

 {conversations.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No conversations yet. Start one!
 </CardContent></Card>
 ) : (
 <div className="space-y-2">
 {conversations.map((c) => (
 <Card key={c.id} className="hover:transition-shadow cursor-pointer" onClick={() => setActiveConv(c.id)}>
 <CardContent className="p-3 flex items-center gap-3">
 <Avatar className="h-10 w-10" style={{ backgroundColor: avatarColor(c.participants.filter((p: any) => p.userId !== me.id).map((p: any) => p.user.name).join(', ') || 'C') }}>
 <AvatarFallback className="text-white text-xs">
 {c.type === 'DIRECT'
 ? initials(c.participants.filter((p: any) => p.userId !== me.id).map((p: any) => p.user.name)[0] || '?')
 : <MessageSquare className="h-4 w-4" />}
 </AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <div className="font-medium truncate">
 {c.title || c.participants.filter((p: any) => p.userId !== me.id).map((p: any) => p.user.name).join(', ')}
 </div>
 {c.unreadCount > 0 && <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{c.unreadCount}</span>}
 </div>
 {c.lastMessage && (
 <div className="text-xs text-muted-foreground truncate">
 <strong>{c.lastMessage.sender?.name}:</strong> {c.lastMessage.body}
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <NewConversationDialog
 open={newConvOpen}
 onOpenChange={setNewConvOpen}
 clubId={clubId}
 currentUserId={me.id}
 onCreated={(id) => { setNewConvOpen(false); setActiveConv(id); refetch(); }}
 />
 </div>
 )
}

function ConversationView({ conversationId, userId, onBack }: { conversationId: string; userId: string; onBack: () => void }) {
 const { data, loading, refetch } = useFetch<{ conversation: any }>(`/api/messages/conversations/${conversationId}?userId=${userId}`)
 const [body, setBody] = useState('')
 const scrollRef = useRef<HTMLDivElement>(null)

 useEffect(() => {
 if (scrollRef.current) {
 scrollRef.current.scrollTop = scrollRef.current.scrollHeight
 }
 }, [data?.conversation?.messages])

 async function send() {
 if (!body.trim()) return
 try {
 await apiPost(`/api/messages/conversations/${conversationId}`, { senderId: userId, body })
 setBody('')
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 if (loading || !data) return <Skeleton className="h-96 w-full" />

 const conv = data.conversation
 const others = conv.participants.filter((p: any) => p.userId !== userId)

 return (
 <div className="space-y-4">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
 <Avatar className="h-8 w-8" style={{ backgroundColor: avatarColor(others.map((p: any) => p.user.name).join(', ')) }}>
 <AvatarFallback className="text-white text-xs">
 {conv.type === 'DIRECT' ? initials(others[0]?.user.name || '?') : <MessageSquare className="h-3 w-3" />}
 </AvatarFallback>
 </Avatar>
 <div>
 <h2 className="font-semibold">{conv.title || others.map((p: any) => p.user.name).join(', ')}</h2>
 <p className="text-xs text-muted-foreground">{conv.participants.length} participants</p>
 </div>
 </div>

 <Card>
 <CardContent className="p-0">
 <ScrollArea className="h-[60vh]" ref={scrollRef as any}>
 <div className="p-4 space-y-3">
 {conv.messages.map((m: any) => {
 const isMe = m.senderId === userId
 return (
 <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
 <Avatar className="h-8 w-8 shrink-0" style={{ backgroundColor: avatarColor(m.sender?.name || '?') }}>
 <AvatarFallback className="text-white text-[10px]">{initials(m.sender?.name || '?')}</AvatarFallback>
 </Avatar>
 <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
 <div className={`px-3 py-2 rounded-lg ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
 <div className="text-sm whitespace-pre-wrap">{m.body}</div>
 </div>
 <div className="text-[10px] text-muted-foreground mt-0.5">{m.sender?.name} · {timeAgo(m.createdAt)}</div>
 </div>
 </div>
 )
 })}
 </div>
 </ScrollArea>
 <div className="border-t p-3 flex gap-2">
 <Input
 value={body}
 onChange={(e) => setBody(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
 placeholder="Type a message…"
 />
 <Button onClick={send} disabled={!body.trim()}><Send className="h-4 w-4" /></Button>
 </div>
 </CardContent>
 </Card>
 </div>
 )
}

function NewConversationDialog({ open, onOpenChange, clubId, currentUserId, onCreated }: any) {
 const { data } = useFetch<{ members: any[] }>(clubId !== 'ALL' ? `/api/members?clubId=${clubId}&limit=200` : '/api/members?limit=200')
 const [selected, setSelected] = useState<string[]>([])
 const [firstMessage, setFirstMessage] = useState('')

 const members = (data?.members || []).filter((m: any) => m.userId !== currentUserId)

 async function create() {
 if (selected.length === 0 || !firstMessage.trim()) {
 toast.error('Pick at least one recipient and write a message')
 return
 }
 try {
 const res = await apiPost('/api/messages/conversations', {
 clubId: clubId !== 'ALL' ? clubId : null,
 type: selected.length === 1 ? 'DIRECT' : 'GROUP',
 participantIds: [currentUserId, ...selected],
 firstMessage,
 senderId: currentUserId,
 })
 onCreated(res.conversation.id)
 setSelected([])
 setFirstMessage('')
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>New conversation</DialogTitle>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Recipients</Label>
 <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
 {members.map((m: any) => (
 <label key={m.userId} className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-muted/50 rounded">
 <input
 type="checkbox"
 checked={selected.includes(m.userId)}
 onChange={(e) => {
 if (e.target.checked) setSelected([...selected, m.userId])
 else setSelected(selected.filter((x: string) => x !== m.userId))
 }}
 />
 <Avatar className="h-6 w-6" style={{ backgroundColor: avatarColor(m.user?.name || '?') }}>
 <AvatarFallback className="text-white text-[10px]">{initials(m.user?.name || '?')}</AvatarFallback>
 </Avatar>
 <span>{m.user?.name}</span>
 </label>
 ))}
 </div>
 </div>
 <div>
 <Label>Message</Label>
 <Input value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} placeholder="Say hi…" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={create}>Start chat</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
