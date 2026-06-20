'use client'

import { useState } from 'react'
import { useFetch, apiPost, apiDelete } from '@/lib/clubhub/hooks'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Image as ImageIcon, Plus, ArrowLeft, Trash2, Calendar, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

export function PhotoAlbumsTab({ clubId }: { clubId: string }) {
 const url = clubId !== 'ALL' ? `/api/photo-albums?clubId=${clubId}` : '/api/photo-albums'
 const { data, loading, refetch } = useFetch<{ albums: any[] }>(url)
 const [createOpen, setCreateOpen] = useState(false)
 const [openAlbum, setOpenAlbum] = useState<string | null>(null)

 if (openAlbum) {
 return <AlbumView albumId={openAlbum} onBack={() => { setOpenAlbum(null); refetch() }} />
 }

 const albums = data?.albums || []

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold">Photo Albums</h2>
 <p className="text-sm text-muted-foreground">Capture and share memories from club events.</p>
 </div>
 <Button onClick={() => setCreateOpen(true)} disabled={clubId === 'ALL'}>
 <Plus className="h-4 w-4" /> New album
 </Button>
 </div>

 {loading ? (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
 {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
 </div>
 ) : albums.length === 0 ? (
 <Card><CardContent className="py-16 text-center text-muted-foreground">
 <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
 No albums yet. Create one to start uploading photos!
 </CardContent></Card>
 ) : (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
 {albums.map((a) => (
 <Card key={a.id} className="overflow-hidden cursor-pointer hover: transition-shadow" onClick={() => setOpenAlbum(a.id)}>
 <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
 {a.photos?.[0]?.url ? (
 <img src={a.photos[0].url} alt={a.title} className="w-full h-full object-cover" />
 ) : (
 <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
 )}
 </div>
 <CardContent className="p-3">
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <div className="font-medium truncate">{a.title}</div>
 <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
 <Calendar className="h-3 w-3" /> {new Date(a.createdAt).toLocaleDateString()}
 </div>
 </div>
 <Badge variant="outline" className="text-[10px]">{a._count?.photos || 0} photos</Badge>
 </div>
 {a.isPublic && <Badge className="mt-1 text-[9px]">PUBLIC</Badge>}
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <CreateAlbumDialog open={createOpen} onOpenChange={setCreateOpen} clubId={clubId} onCreated={() => refetch()} />
 </div>
 )
}

function AlbumView({ albumId, onBack }: { albumId: string; onBack: () => void }) {
 const { data, loading, refetch } = useFetch<{ album: any }>(`/api/photo-albums/${albumId}`)
 const [urlInput, setUrlInput] = useState('')
 const [captionInput, setCaptionInput] = useState('')
 const [uploading, setUploading] = useState(false)

 async function addPhotos() {
 if (!urlInput.trim()) return
 setUploading(true)
 try {
 const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean)
 await apiPost(`/api/photo-albums/${albumId}/photos`, { urls, caption: captionInput })
 setUrlInput(''); setCaptionInput('')
 toast.success(`Added ${urls.length} photo(s)`)
 refetch()
 } catch (e: any) { toast.error(e.message) }
 setUploading(false)
 }

 async function deletePhoto(photoId: string) {
 try {
 await apiDelete(`/api/photo-albums/${albumId}/photos?id=${photoId}`)
 refetch()
 } catch (e: any) { toast.error(e.message) }
 }

 async function deleteAlbum() {
 if (!confirm('Delete this album and all its photos?')) return
 try {
 await apiDelete(`/api/photo-albums/${albumId}`)
 onBack()
 } catch (e: any) { toast.error(e.message) }
 }

 if (loading || !data) return <Skeleton className="h-96 w-full" />
 const album = data.album

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between flex-wrap gap-2">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
 <div>
 <h2 className="text-lg font-semibold">{album.title}</h2>
 <p className="text-sm text-muted-foreground">
 {album._count?.photos || album.photos?.length || 0} photos · {new Date(album.createdAt).toLocaleDateString()}
 {album.event && <> · Linked to <strong>{album.event.title}</strong></>}
 </p>
 </div>
 </div>
 <Button variant="outline" size="sm" onClick={deleteAlbum}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete album</Button>
 </div>

 {album.description && <p className="text-sm text-muted-foreground">{album.description}</p>}

 <Card>
 <CardContent className="p-4 space-y-3">
 <div className="text-sm font-medium">Add photos by URL</div>
 <p className="text-xs text-muted-foreground">
 Upload images via the upload button or paste direct URLs (one per line). For demo purposes, you can use any image URL.
 </p>
 <Textarea
 value={urlInput}
 onChange={(e) => setUrlInput(e.target.value)}
 placeholder={'https://example.com/photo1.jpg\nhttps://example.com/photo2.jpg'}
 rows={3}
 />
 <Input value={captionInput} onChange={(e) => setCaptionInput(e.target.value)} placeholder="Caption (applies to all)" />
 <Button onClick={addPhotos} disabled={uploading || !urlInput.trim()}>
 <Plus className="h-4 w-4 mr-1" /> {uploading ? 'Adding...' : 'Add photos'}
 </Button>
 </CardContent>
 </Card>

 {album.photos?.length > 0 ? (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
 {album.photos.map((p: any) => (
 <Card key={p.id} className="overflow-hidden group relative">
 <div className="aspect-square bg-muted">
 <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover" />
 </div>
 {p.caption && (
 <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs">
 {p.caption}
 </div>
 )}
 <Button
 variant="destructive"
 size="icon"
 className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
 onClick={() => deletePhoto(p.id)}
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 <a
 href={p.url}
 target="_blank"
 rel="noopener noreferrer"
 className="absolute top-2 left-2 h-7 w-7 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
 >
 <ExternalLink className="h-3.5 w-3.5" />
 </a>
 </Card>
 ))}
 </div>
 ) : (
 <Card><CardContent className="py-12 text-center text-muted-foreground">
 <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
 No photos yet. Add some above.
 </CardContent></Card>
 )}
 </div>
 )
}

function CreateAlbumDialog({ open, onOpenChange, clubId, onCreated }: any) {
 const [title, setTitle] = useState('')
 const [description, setDescription] = useState('')
 const [isPublic, setIsPublic] = useState(false)

 async function submit() {
 if (!title) { toast.error('Title required'); return }
 try {
 await apiPost('/api/photo-albums', { clubId, title, description, isPublic })
 setTitle(''); setDescription(''); setIsPublic(false)
 onOpenChange(false); onCreated()
 toast.success('Album created')
 } catch (e: any) { toast.error(e.message) }
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>New photo album</DialogTitle>
 <DialogDescription>Create an album to organize photos from events.</DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label>Title</Label>
 <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Spring 2026 Showcase" />
 </div>
 <div>
 <Label>Description (optional)</Label>
 <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
 </div>
 <div className="flex items-center gap-2">
 <Switch checked={isPublic} onCheckedChange={setIsPublic} />
 <Label className="cursor-pointer" onClick={() => setIsPublic(!isPublic)}>
 Public (visible on recruitment portal)
 </Label>
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
 <Button onClick={submit}>Create album</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
