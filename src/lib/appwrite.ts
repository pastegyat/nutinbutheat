import type { Post } from '../types/post'
import type { Album, AlbumItem } from '../types/album'
export const apiUrl = import.meta.env.VITE_APPWRITE_API_URL
let publicPostsPromise: Promise<Post[]> | null = null
let reactionCountsPromise: Promise<Record<string, ReactionCounts>> | null = null
export function clearPublicPostsCache() { publicPostsPromise = null }
export async function getPublicPosts(): Promise<Post[]> {
  if (!apiUrl) return [] as Post[]
  publicPostsPromise ??= fetch(`${apiUrl}/posts/all`).then(async r => {
    if (!r.ok) throw new Error('Post list failed')
    const d = await r.json() as { posts: Post[] }
    return d.posts
  })
  try { return await publicPostsPromise } catch { publicPostsPromise = null; throw new Error('Failed to load posts') }
}
export async function getReactionCountsAll(): Promise<Record<string, ReactionCounts>> { if (!apiUrl) return {}; reactionCountsPromise ??= fetch(`${apiUrl}/reactions/all`).then(async r => r.ok ? await r.json() as Record<string, ReactionCounts> : {}).catch(() => { reactionCountsPromise = null; return {} }); return reactionCountsPromise }
export function clearReactionCountsCache() { reactionCountsPromise = null }
export async function getPostBySlug(slug: string): Promise<Post | null> { if (!apiUrl || !slug) return null as Post | null; try { const r = await fetch(`${apiUrl}/posts/${encodeURIComponent(slug)}`); return r.ok ? await r.json() as Post : null } catch { return null as Post | null } }
export type Paste = { slug: string; title: string; content: string; created_at: string }
export async function getPasteBySlug(slug: string): Promise<Paste | null> { if (!apiUrl || !slug) return null; try { const r = await fetch(`${apiUrl}/pastes/${encodeURIComponent(slug)}`); return r.ok ? await r.json() as Paste : null } catch { return null } }
export async function trackPostEvent(postId: string, event: 'view' | 'link_click') { if (apiUrl) await fetch(`${apiUrl}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, event }) }) }
// Batched +1 view counts for scroll-pass impressions (Home feed, related grids).
// Fire-and-forget: callers queue IDs and flush periodically; failures are best-effort.
export async function trackPostViews(postIds: string[]) { if (!apiUrl || !postIds.length) return; try { await fetch(`${apiUrl}/events/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ views: postIds }) }) } catch { /* best effort */ } }
let activeId: string | null = null; let activePath: string | null = null; let activeStart = 0
const finalizePage = () => { if (!activeId) return; const id = activeId; const duration_ms = Date.now() - activeStart; activeId = null; activePath = null; if (!apiUrl) return; fetch(`${apiUrl}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, duration_ms }) }).catch(() => { /* best effort */ }) }
if (typeof window !== 'undefined') { window.addEventListener('pagehide', finalizePage); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') finalizePage() }) }
export function trackPageView(path: string, search?: string) {
  if (!apiUrl) return
  const term = search && search.trim() ? search.trim().slice(0, 128) : ''
  // Same path + search refinement: update the active row only (no new visit).
  if (term && activeId && activePath === path) { fetch(`${apiUrl}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activeId, search: term }) }).catch(() => { /* best effort */ }); return }
  // Every other call is a genuine visit: finalize the previous row, insert a fresh +1 row.
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
  albumViewsTotal: number
  recentAlbums: Array<{ title: string; slug: string; views: number; created_at: string }>
}
export async function getAlbums(page = 1, q = ''): Promise<{ total: number; page: number; per: number; albums: Album[] }> { if (!apiUrl) return { total: 0, page, per: 20, albums: [] }; const params = new URLSearchParams({ page: String(page), per: '20' }); if (q.trim()) params.set('q', q.trim()); try { const r = await fetch(`${apiUrl}/albums?${params}`); if (!r.ok) return { total: 0, page, per: 20, albums: [] }; const data = await r.json() as { total: number; page: number; per: number; albums: Album[] }; return data } catch { return { total: 0, page, per: 20, albums: [] } } }
export async function getAlbumBySlug(slug: string): Promise<{ album: Album; items: AlbumItem[] } | null> { if (!apiUrl || !slug) return null; try { const r = await fetch(`${apiUrl}/albums/${encodeURIComponent(slug)}`); if (!r.ok) return null; return await r.json() as { album: Album; items: AlbumItem[] } } catch { return null } }
export async function getAdminStats(token: string): Promise<{ status: number; data: AdminStats | null }> { if (!apiUrl) return { status: 0, data: null }; try { const r = await fetch(`${apiUrl}/admin/stats`, { method: 'POST', headers: { 'X-Admin-Token': token } }); return r.ok ? { status: r.status, data: await r.json() as AdminStats } : { status: r.status, data: null } } catch { return { status: 0, data: null } } }
