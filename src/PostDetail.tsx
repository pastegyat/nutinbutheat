import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './PostDetail.css'
import './SearchOverride.css'
import './RelatedCardDescription.css'
import type { Post } from './types/post'
import { getReactionCountsAll, getPostBySlug, getPublicPosts, toggleReaction, trackPageView, trackPostEvent, trackPostViews, clearReactionCountsCache, type ReactionCounts } from './lib/appwrite'
import { timeAgo } from './lib/format'
import { linkTo } from './lib/router'
import { ThumbDown, ThumbUp } from './lib/icons'

const navItems: Array<{ label: string; path: string; badge?: boolean }> = [
  { label: 'Home', path: '/' },
  { label: 'Albums', path: '/albums', badge: true },
  { label: 'Trending', path: '/trending' },
  { label: 'Categories', path: '/categories' },
  { label: 'About', path: '/about' },
  { label: 'Terms of Service', path: '/terms' },
  { label: 'Contact', path: '/contact' },
  { label: 'Privacy', path: '/privacy' },
]
const linkify = (text: string, postId?: string) => { const parts: ReactNode[] = []; let last = 0; for (const match of text.matchAll(/(https?:\/\/\S+)/g)) { const idx = match.index ?? 0; if (idx > last) parts.push(text.slice(last, idx)); parts.push(<a key={idx} href={match[0]} target="_blank" rel="noopener noreferrer" onClick={postId ? () => trackPostEvent(postId, 'link_click') : undefined}>{match[0]}</a>); last = idx + match[0].length } if (last < text.length) parts.push(text.slice(last)); return parts }

export default function PostDetail({ slug = '' }: { slug?: string }) {
  const [post, setPost] = useState<Post | null | undefined>(undefined)
  const [posts, setPosts] = useState<Post[]>([])
  const [counts, setCounts] = useState<Record<string, ReactionCounts>>({})
  const [vote, setVote] = useState<'like' | 'dislike' | undefined>(); const [reportOpen, setReportOpen] = useState(false); const [sent, setSent] = useState(false); const [reportError, setReportError] = useState(''); const [reporting, setReporting] = useState(false); const [menu, setMenu] = useState(false); const [query, setQuery] = useState('')
  const [rvotes, setRVotes] = useState<Record<string, 'like' | 'dislike' | undefined>>({})
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => { let cancelled = false; (async () => { const found = slug ? await getPostBySlug(slug) : null; if (cancelled) return; setPost(found); const [list, countsAll] = await Promise.all([getPublicPosts(), getReactionCountsAll()]); if (cancelled) return; setPosts(list); setCounts(countsAll); if (found) {
    document.title = `${found.title} - NutinButHeat`
    const setMeta = (key: string, content: string) => {
      let el = document.querySelector(`meta[${key.startsWith('twitter') ? 'name' : 'property'}="${key}"]`) as HTMLMetaElement | null
      if (!el) { el = document.createElement('meta'); el.setAttribute(key.startsWith('twitter') ? 'name' : 'property', key); document.head.appendChild(el) }
      el.content = content
    }
    setMeta('og:type', 'article')
    setMeta('og:title', found.title)
    setMeta('og:description', (found.description ?? '').slice(0, 160))
    const previewImg = (found.preview_image_url ?? '').trim() || found.image_url
    if (previewImg) setMeta('og:image', previewImg)
    setMeta('og:image:width', '1200')
    setMeta('og:image:height', '630')
    setMeta('og:image:alt', found.title)
    setMeta('og:url', `https://nutinbutheat.com/${found.slug}`)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', found.title)
    setMeta('twitter:description', (found.description ?? '').slice(0, 160))
    if (previewImg) setMeta('twitter:image', previewImg)
    setMeta('twitter:image:alt', found.title)
    if (found.category) setMeta('article:section', found.category)
    if (found.created_at) setMeta('article:published_time', found.created_at)
    trackPostEvent(found.$id, 'view') } })(); return () => { cancelled = true } }, [slug])
  const related = useMemo(() => posts.filter(item => item.$id !== post?.$id), [posts, post])
  const [relatedCount, setRelatedCount] = useState(5)
  useEffect(() => { const t = setTimeout(() => setRelatedCount(5), 0); return () => clearTimeout(t) }, [slug])
  const visibleRelated = useMemo(() => related.slice(0, relatedCount), [related, relatedCount])

  const relatedSentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRelated = () => setRelatedCount(c => Math.min(c + 5, related.length))
  useEffect(() => {
    if (query) return
    if (relatedCount >= related.length) return
    const el = relatedSentinelRef.current; if (!el) return
    const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMoreRelated() }, { rootMargin: '800px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [query, relatedCount, related.length])
  useEffect(() => {
    if (query) return
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 900) {
        setRelatedCount(c => Math.min(c + 5, related.length))
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [query, relatedCount, related.length])
  useEffect(() => { const term = query.trim(); if (!term) return; const t = setTimeout(() => trackPageView(location.pathname + location.search, term), 600); return () => clearTimeout(t) }, [query])

  // Scroll-pass view counting for related posts: each card scrolled into view = +1 (batched).
  const relatedGridRef = useRef<HTMLDivElement>(null)
  const relSeenRef = useRef<Set<string>>(new Set())
  const relQueueRef = useRef<string[]>([])
  useEffect(() => { relSeenRef.current = new Set(); relQueueRef.current = [] }, [slug])
  useEffect(() => {
    const flush = () => { const q = relQueueRef.current; if (!q.length) return; relQueueRef.current = []; trackPostViews(q) }
    const t = setInterval(flush, 2000)
    window.addEventListener('pagehide', flush)
    return () => { clearInterval(t); window.removeEventListener('pagehide', flush); flush() }
  }, [])
  useEffect(() => {
    if (query) return
    const grid = relatedGridRef.current; if (!grid) return
    const seen = relSeenRef.current
    const obs = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const id = (entry.target as HTMLElement).dataset.id; if (!id || seen.has(id)) continue
        seen.add(id); relQueueRef.current.push(id)
        obs.unobserve(entry.target)
      }
      if (relQueueRef.current.length >= 20) { const q = relQueueRef.current; relQueueRef.current = []; trackPostViews(q) }
    }, { threshold: 0 })
    grid.querySelectorAll<HTMLElement>('[data-id]').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [visibleRelated, query])
  const visible = useMemo(() => query ? posts.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())) : [], [posts, query])
  const castVote = async (type: 'like' | 'dislike') => { if (!post) return; const totals = await toggleReaction(post.$id, type); clearReactionCountsCache(); setCounts(c => ({ ...c, [post.$id]: totals })); setVote(v => v === type ? undefined : type) }
  const castRelated = async (id: string, type: 'like' | 'dislike') => { const totals = await toggleReaction(id, type); clearReactionCountsCache(); setCounts(c => ({ ...c, [id]: totals })); setRVotes(v => ({ ...v, [id]: v[id] === type ? undefined : type })) }
  const close = () => { setReportOpen(false); setSent(false); setReportError('') }
  const submitReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!post || reporting) return
    setReportError(''); setReporting(true)
    try {
      const reason = new FormData(e.currentTarget).get('reason')
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.$id, reason: String(reason ?? '').trim() }) })
      if (!r.ok) { const j = await r.json().catch(() => null) as { error?: string } | null; throw new Error(j?.error ?? `HTTP ${r.status}`) }
      setSent(true)
    } catch (err) { setReportError(err instanceof Error ? err.message : 'Could not submit report.') } finally { setReporting(false) }
  }
  const renderCard = (item: Post) => { const current = rvotes[item.$id]; const count = counts[item.$id]; return <article className="card" key={item.$id} data-id={item.$id}><div className="photo"><img src={item.image_url} alt={item.title} /><strong className={item.is_premium === 'yes' ? 'exclusive' : 'free'}>{item.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong></div><div className="copy"><div><h2>{item.title}</h2><time>{timeAgo(item.created_at)}</time></div><p>{linkify(item.description, item.$id)}</p><footer><span><button className={current === 'like' ? 'selected like' : ''} onClick={() => castRelated(item.$id, 'like')}><ThumbUp size={13} /> {count?.likes ?? 0}</button><button className={current === 'dislike' ? 'selected dislike' : ''} onClick={() => castRelated(item.$id, 'dislike')}><ThumbDown size={13} /> {count?.dislikes ?? 0}</button></span><span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><a href="https://x.com/nutinbutheat2" target="_blank" rel="noopener noreferrer" className="x-link" aria-label="X"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M18.9 1H22.2L14 10.2 23.4 22H17L12.4 16.2 6.9 22H3.6L12.1 12.4 3 1H9.6L13.6 6.1 18.9 1ZM16.2 20.1H18L8.3 2.9H6.5L16.2 20.1Z"/></svg></a></span></footer></div></article> }
  return <div className="detail-page">
    <header className="detail-header"><div className="detail-bar"><button className={`detail-hamburger ${menu ? 'open' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><i /><i /><i /></button><a href="/" onClick={linkTo('/')} className="detail-logo"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a><label className="detail-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search content..." aria-label="Search content" /><b>⌕</b></label></div></header>
    <aside className={`detail-drawer ${menu ? 'show' : ''}`}>{navItems.map(item => <a key={item.label} href={item.path} onClick={e => { linkTo(item.path)(e as unknown as React.MouseEvent<HTMLAnchorElement>); setMenu(false) }}>{item.label}{item.badge && <small>NEW</small>}</a>)}</aside><button className={`detail-shade ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} aria-label="Close navigation" />
    <main className="detail-main">{query ? <section className="search-results"><div className="related-heading"><p>Search results for “{query}”</p><h1>Matching drops</h1></div>{visible.length ? <div className="related-grid" ref={gridRef}>{visible.map(renderCard)}</div> : <p className="no-results">No posts match your search.</p>}</section> : post === undefined ? <p className="no-results">Loading…</p> : !post ? <p className="no-results">Post not found.</p> : <>
      <article className="main-post">
        <div className="main-image"><img src={post.image_url} alt={post.title} /><strong>{post.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong></div>
        <div className="main-copy"><div className="main-title"><div><p className="detail-kicker">{post.category} · Featured drop</p><h1>{post.title}</h1></div><time>{timeAgo(post.created_at)}</time></div><p className="main-description">{linkify(post.description, post.$id)}</p><div className="main-actions"><div><button className={vote === 'like' ? 'active like' : ''} onClick={() => castVote('like')}><ThumbUp size={14} /> {counts[post.$id]?.likes ?? 0}</button><button className={vote === 'dislike' ? 'active dislike' : ''} onClick={() => castVote('dislike')}><ThumbDown size={14} /> {counts[post.$id]?.dislikes ?? 0}</button></div><div><a href="https://x.com/nutinbutheat2" target="_blank" rel="noopener noreferrer" className="x-link" aria-label="X"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M18.9 1H22.2L14 10.2 23.4 22H17L12.4 16.2 6.9 22H3.6L12.1 12.4 3 1H9.6L13.6 6.1 18.9 1ZM16.2 20.1H18L8.3 2.9H6.5L16.2 20.1Z"/></svg></a><button className="report" onClick={() => setReportOpen(true)}>🚩 Report</button></div></div></div>
      </article>
      {visibleRelated.length > 0 && <section className="related"><div className="related-heading"><p>Keep exploring</p><h2>More fresh drops</h2></div><div className="related-grid related-endless" ref={relatedGridRef}>{visibleRelated.map(renderCard)}</div>{relatedCount < related.length && <div ref={relatedSentinelRef} style={{ minHeight: 1 }}><p className="no-results" style={{ padding: '24px 0', textAlign: 'center' }}>Loading more…</p></div>}</section>}</>}
    </main>
    {reportOpen && <div className="modal-layer" role="presentation"><button className="modal-backdrop" onClick={close} aria-label="Close report dialog" /><form className="report-dialog" onSubmit={submitReport}><button type="button" className="modal-close" onClick={close}>×</button><h2>{sent ? 'Report submitted' : 'Report post'}</h2>{sent ? <p>Thanks for helping keep the community safe.</p> : <><label htmlFor="reason">Tell us what happened</label><textarea id="reason" name="reason" required maxLength={2000} placeholder="Reason for reporting..." />{reportError && <p className="report-error">{reportError}</p>}<button type="submit" className="submit-report" disabled={reporting}>{reporting ? 'Submitting…' : 'Submit report'}</button></>}</form></div>}
  </div>
}
