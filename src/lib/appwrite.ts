import { Account, Client, Databases, Query } from 'appwrite'
import type { Post } from '../types/post'
import type { Album, AlbumItem } from '../types/album'
const client = new Client(); const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT; const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID
if (endpoint && projectId) client.setEndpoint(endpoint).setProject(projectId)
const databases = new Databases(client)
export const account = new Account(client)
export const apiUrl = import.meta.env.VITE_APPWRITE_API_URL
export async function getPublicPosts() { const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID; const collectionId = import.meta.env.VITE_APPWRITE_POSTS_COLLECTION_ID; if (!databaseId || !collectionId) return [] as Post[]; if (apiUrl) { try { const r = await fetch(`${apiUrl}/posts/all`); if (r.ok) { const d = await r.json() as { posts: Post[] }; return d.posts } } catch { /* fall through to SDK */ } } const all: Post[] = []; let offset = 0; while (true) { const res = await databases.listDocuments(databaseId, collectionId, [Query.equal('status', 'public'), Query.orderDesc('created_at'), Query.limit(100), ...(offset ? [Query.offset(offset)] : [])]); all.push(...res.documents as unknown as Post[]); if (res.documents.length < 100 || all.length >= 5000) break; offset += 100 } return all }
export async function getReactionCountsAll(): Promise<Record<string, ReactionCounts>> { if (!apiUrl) return {}; try { const r = await fetch(`${apiUrl}/reactions/all`); return r.ok ? await r.json() as Record<string, ReactionCounts> : {} } catch { return {} } }
export async function getPostBySlug(slug: string) { const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID; const collectionId = import.meta.env.VITE_APPWRITE_POSTS_COLLECTION_ID; if (!databaseId || !collectionId || !slug) return null as Post | null; const res = await databases.listDocuments(databaseId, collectionId, [Query.equal('slug', slug), Query.limit(1)]); return (res.documents[0] ?? null) as unknown as Post | null }
export async function trackPostEvent(postId: string, event: 'view' | 'link_click') { if (apiUrl) await fetch(`${apiUrl}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, event }) }) }
let activeId: string | null = null; let activePath: string | null = null; let activeStart = 0
const finalizePage = () => { if (!activeId) return; const id = activeId; const duration_ms = Date.now() - activeStart; activeId = null; activePath = null; if (!apiUrl) return; fetch(`${apiUrl}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, duration_ms }) }).catch(() => { /* best effort */ }) }
if (typeof window !== 'undefined') { window.addEventListener('pagehide', finalizePage); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') finalizePage() }) }
export function trackPageView(path: string, search?: string) {
  if (!apiUrl) return
  const term = search && search.trim() ? search.trim().slice(0, 128) : ''
  if (activeId && activePath === path) { if (term) fetch(`${apiUrl}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activeId, search: term }) }).catch(() => { /* best effort */ }); return }
  if (activeId) finalizePage()
  fetch(`${apiUrl}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, search: term || undefined }) }).then(r => r.json()).then(d => { if (d && d.id) { activeId = d.id; activePath = path; activeStart = Date.now() } }).catch(() => { /* best effort */ })
}
export type ReactionCounts = { likes: number; dislikes: number }
export async function fetchReactionCounts(postId: string): Promise<ReactionCounts> { if (!apiUrl) return { likes: 0, dislikes: 0 }; try { const r = await fetch(`${apiUrl}/reactions?postId=${encodeURIComponent(postId)}`); return r.ok ? await r.json() as ReactionCounts : { likes: 0, dislikes: 0 } } catch { return { likes: 0, dislikes: 0 } } }
export async function toggleReaction(postId: string, type: 'like' | 'dislike'): Promise<ReactionCounts> { if (!apiUrl) return { likes: 0, dislikes: 0 }; try { const r = await fetch(`${apiUrl}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, type }) }); return r.ok ? await r.json() as ReactionCounts : { likes: 0, dislikes: 0 } } catch { return { likes: 0, dislikes: 0 } } }
export type AdminStats = {
  totals: { posts: number; publicCount: number; privateCount: number; postViews: number; linkClicks: number }
  recentPosts: Array<{ title: string; views: number; link_clicks: number; created_at: string }>
  topClicked: Array<{ title: string; link_clicks: number; slug: string }>
  traffic: Array<{ day: string; views: number }>
  todayViews: number
  topPages: Array<{ path: string; visits: number; avgDuration: number | null }>
  topSearches: Array<{ term: string; count: number }>
}
export async function getAlbums(page = 1, q = ''): Promise<{ total: number; page: number; per: number; albums: Album[] }> { if (!apiUrl) return { total: 0, page, per: 20, albums: [] }; const params = new URLSearchParams({ page: String(page), per: '20' }); if (q.trim()) params.set('q', q.trim()); try { const r = await fetch(`${apiUrl}/albums?${params}`); if (!r.ok) return { total: 0, page, per: 20, albums: [] }; const data = await r.json() as { total: number; page: number; per: number; albums: Album[] }; return data } catch { return { total: 0, page, per: 20, albums: [] } } }
export async function getAlbumBySlug(slug: string): Promise<{ album: Album; items: AlbumItem[] } | null> { if (!apiUrl || !slug) return null; try { const r = await fetch(`${apiUrl}/albums/${encodeURIComponent(slug)}`); if (!r.ok) return null; return await r.json() as { album: Album; items: AlbumItem[] } } catch { return null } }
export async function getAdminStats(token: string): Promise<{ status: number; data: AdminStats | null }> { if (!apiUrl) return { status: 0, data: null }; try { const r = await fetch(`${apiUrl}/admin/stats`, { method: 'POST', headers: { 'X-Admin-Token': token } }); return r.ok ? { status: r.status, data: await r.json() as AdminStats } : { status: r.status, data: null } } catch { return { status: 0, data: null } } }
