import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './Home.css'
import type { Post } from './types/post'
import { getReactionCountsAll, getPublicPosts, toggleReaction, trackPageView, trackPostEvent, trackPostViews, clearReactionCountsCache, clearPublicPostsCache, type ReactionCounts } from './lib/appwrite'
import { timeAgo } from './lib/format'
import { linkTo } from './lib/router'
import { ThumbDown, ThumbUp } from './lib/icons'
import { ChristmasHat } from './ChristmasEffects'
import { useChristmasEnabled } from './lib/settings'

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

const PER_PAGE = 100
function getPage() { const n = parseInt(new URLSearchParams(window.location.search).get('page') ?? '1', 10); return Number.isFinite(n) && n > 0 ? n : 1 }

export default function Home() {
  const [menu, setMenu] = useState(false); const [query, setQuery] = useState(''); const [posts, setPosts] = useState<Post[]>([]); const [counts, setCounts] = useState<Record<string, ReactionCounts>>({}); const [votes, setVotes] = useState<Record<string, 'like' | 'dislike' | undefined>>({}); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const christmasMode = useChristmasEnabled()
  const [page, setPage] = useState(() => getPage())

  useEffect(() => {
    const sync = () => { setPage(getPage()); window.scrollTo({ top: 0 }) }
    window.addEventListener('popstate', sync)
    window.addEventListener('nbh:navigate', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('nbh:navigate', sync) }
  }, [])

  useEffect(() => { let cancelled = false; (async () => { try { const [list, countsAll] = await Promise.all([getPublicPosts(), getReactionCountsAll()]); if (cancelled) return; setPosts(list); setCounts(countsAll); setError(null); } catch { if (cancelled) return; setError('Failed to load posts. Try again.'); } setLoading(false) })(); return () => { cancelled = true } }, [])
  const filtered = useMemo(() => posts.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase())), [posts, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const visible = useMemo(() => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtered, page])

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0)
    return () => clearTimeout(t)
  }, [query])
  useEffect(() => { const term = query.trim(); if (!term) return; const t = setTimeout(() => trackPageView(location.pathname + location.search, term), 600); return () => clearTimeout(t) }, [query])

  // Scroll-pass view counting: each card scrolled into view = +1 view (batched).
  const gridRef = useRef<HTMLDivElement>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<string[]>([])
  useEffect(() => { seenRef.current = new Set(); queueRef.current = [] }, [page, query])
  useEffect(() => {
    const flush = () => { const q = queueRef.current; if (!q.length) return; queueRef.current = []; trackPostViews(q) }
    const t = setInterval(flush, 2000)
    window.addEventListener('pagehide', flush)
    return () => { clearInterval(t); window.removeEventListener('pagehide', flush); flush() }
  }, [])
  useEffect(() => {
    const grid = gridRef.current; if (!grid) return
    const seen = seenRef.current
    const obs = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const id = (entry.target as HTMLElement).dataset.id; if (!id || seen.has(id)) continue
        seen.add(id); queueRef.current.push(id)
        obs.unobserve(entry.target)
      }
      if (queueRef.current.length >= 20) { const q = queueRef.current; queueRef.current = []; trackPostViews(q) }
    }, { threshold: 0 })
    grid.querySelectorAll<HTMLElement>('[data-id]').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [visible])

  const vote = async (post: Post, type: 'like' | 'dislike') => { const current = votes[post.$id]; const totals = await toggleReaction(post.$id, type); clearReactionCountsCache(); setCounts(c => ({ ...c, [post.$id]: totals })); setVotes(v => ({ ...v, [post.$id]: current === type ? undefined : type })) }
  const renderCard = (post: Post, extra = '') => { const current = votes[post.$id]; const count = counts[post.$id]; return <article className={`card ${christmasMode ? 'christmas' : ''} ${extra}`} key={post.$id} data-id={post.$id}><div className="photo"><a href={`/${post.slug}`} onClick={linkTo(`/${post.slug}`)} aria-label={post.title}><img src={post.image_url} alt={post.title} /></a><strong className={post.is_premium === 'yes' ? 'exclusive' : 'free'}>{post.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong></div><div className="copy"><div><h2>{post.title}</h2><time>{timeAgo(post.created_at)}</time></div><p>{linkify(post.description, post.$id)}</p><footer><span><button className={current === 'like' ? 'selected like' : ''} onClick={() => vote(post, 'like')}><ThumbUp size={13} /> {count?.likes ?? 0}</button><button className={current === 'dislike' ? 'selected dislike' : ''} onClick={() => vote(post, 'dislike')}><ThumbDown size={13} /> {count?.dislikes ?? 0}</button></span><span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><a href="https://x.com/nutinbutheat2" target="_blank" rel="noopener noreferrer" className="x-link" aria-label="X"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M18.9 1H22.2L14 10.2 23.4 22H17L12.4 16.2 6.9 22H3.6L12.1 12.4 3 1H9.6L13.6 6.1 18.9 1ZM16.2 20.1H18L8.3 2.9H6.5L16.2 20.1Z"/></svg></a></span></footer></div></article> }
  const gotoPage = (p: number) => (e: React.MouseEvent<HTMLAnchorElement>) => { linkTo(`?page=${p}`)(e); window.scrollTo({ top: 0 }) }
  const retry = () => { setError(null); setLoading(true); clearPublicPostsCache(); setCounts({}); setPosts([]); (async () => { try { const [list, countsAll] = await Promise.all([getPublicPosts(), getReactionCountsAll()]); setPosts(list); setCounts(countsAll); setError(null); } catch { setError('Failed to load posts. Try again.'); } setLoading(false) })(); }
  return <div className="nbh">
    <header><div className="bar"><button className={`hamburger ${menu ? 'open' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><ChristmasHat /><i /><i /><i /></button><a className="logo" href="/" onClick={linkTo('/')}><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a><label className="search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search content..." aria-label="Search content" /><b>⌕</b></label></div></header>
    <aside className={`drawer ${menu ? 'show' : ''}`}>{navItems.map(x => <a key={x.label} href={x.path} onClick={e => { linkTo(x.path)(e as unknown as React.MouseEvent<HTMLAnchorElement>); setMenu(false) }}>{x.label}{x.badge && <small>NEW</small>}</a>)}</aside><button className={`shade ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} aria-label="Close navigation" />
    <main id="top"><section className={`intro ${christmasMode ? 'intro-christmas' : ''}`}>{christmasMode && <div className="hero-garland" aria-hidden="true"><span>✦</span><span>●</span><span>✦</span><span>●</span><span>✦</span><span>●</span><span>✦</span></div>}<p>Fresh Drops</p><h1>What&apos;s <em>Hot</em> Right Now</h1><span>The freshest exclusive content — dropping daily.</span>{christmasMode && <div className="hero-holly hero-holly-left" aria-hidden="true">❧</div>}{christmasMode && <div className="hero-holly hero-holly-right" aria-hidden="true">❧</div>}</section><div className="rule" />
    <section id="content" className="feed">{loading ? <p className="none">Loading drops…</p> : error ? <div className="none"><p>{error}</p><button onClick={retry}>Try again</button></div> : visible.length ? <>
      <div className="grid" ref={gridRef}>{visible.map(post => renderCard(post))}</div>
      {totalPages > 1 && <div className="pagination">
        <a href={`?page=${Math.max(1, page - 1)}`} onClick={gotoPage(Math.max(1, page - 1))} className={`pag-btn ${page <= 1 ? 'disabled' : ''}`}>← Prev</a>
        {(() => { const s = Math.max(1, page - 2); const e = Math.min(totalPages, page + 2); const els: React.ReactNode[] = []; if (s > 1) { els.push(<a key={1} href="?page=1" onClick={gotoPage(1)} className="pag-btn">1</a>); if (s > 2) els.push(<span key="dots1" className="pag-dots">…</span>) } for (let i = s; i <= e; i++) els.push(<a key={i} href={`?page=${i}`} onClick={gotoPage(i)} className={`pag-btn ${i === page ? 'active' : ''}`}>{i}</a>); if (e < totalPages) { if (e < totalPages - 1) els.push(<span key="dots2" className="pag-dots">…</span>); els.push(<a key={totalPages} href={`?page=${totalPages}`} onClick={gotoPage(totalPages)} className="pag-btn">{totalPages}</a>) } return els })()}
        <a href={`?page=${Math.min(totalPages, page + 1)}`} onClick={gotoPage(Math.min(totalPages, page + 1))} className={`pag-btn ${page >= totalPages ? 'disabled' : ''}`}>Next →</a>
      </div>}
    </> : <p className="none">No items found for “{query}”.</p>}</section></main>
  </div>
}

