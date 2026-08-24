import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './Home.css'
import type { Post } from './types/post'
import { fetchReactionCounts, getPublicPosts, toggleReaction, trackPageView, trackPostEvent, type ReactionCounts } from './lib/appwrite'
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

const PER_PAGE = 100
function getPage() { const n = parseInt(new URLSearchParams(window.location.search).get('page') ?? '1', 10); return Number.isFinite(n) && n > 0 ? n : 1 }

export default function Home() {
  const [menu, setMenu] = useState(false); const [query, setQuery] = useState(''); const [posts, setPosts] = useState<Post[]>([]); const [counts, setCounts] = useState<Record<string, ReactionCounts>>({}); const [votes, setVotes] = useState<Record<string, 'like' | 'dislike' | undefined>>({}); const [copied, setCopied] = useState<string | null>(null); const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(() => getPage())

  useEffect(() => {
    const sync = () => { setPage(getPage()); window.scrollTo({ top: 0 }) }
    window.addEventListener('popstate', sync)
    window.addEventListener('nbh:navigate', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('nbh:navigate', sync) }
  }, [])

  useEffect(() => { let cancelled = false; (async () => { const list = await getPublicPosts(); if (cancelled) return; setPosts(list); setLoading(false); const totals = await Promise.all(list.map(async post => [post.$id, await fetchReactionCounts(post.$id)] as const)); if (cancelled) return; setCounts(Object.fromEntries(totals)) })(); return () => { cancelled = true } }, [])
  const filtered = useMemo(() => posts.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase())), [posts, query])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const visible = useMemo(() => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtered, page])

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0)
    return () => clearTimeout(t)
  }, [query])
  useEffect(() => { const term = query.trim(); if (!term) return; const t = setTimeout(() => trackPageView(location.pathname + location.search, term), 600); return () => clearTimeout(t) }, [query])

  const gridRef = useRef<HTMLDivElement>(null); const firedViews = useRef<Set<string>>(new Set())
  useEffect(() => {
    const grid = gridRef.current; if (!grid) return
    const seen = firedViews.current
    const observer = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.isIntersecting) { const id = (entry.target as HTMLElement).dataset.id; if (id && !seen.has(id)) { seen.add(id); trackPostEvent(id, 'view') } } } }, { threshold: 0 })
    grid.querySelectorAll<HTMLElement>('[data-id]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [visible])

  const vote = async (post: Post, type: 'like' | 'dislike') => { const current = votes[post.$id]; const totals = await toggleReaction(post.$id, type); setCounts(c => ({ ...c, [post.$id]: totals })); setVotes(v => ({ ...v, [post.$id]: current === type ? undefined : type })) }
  const copyLink = async (post: Post) => { try { await navigator.clipboard.writeText(`${window.location.origin}/${post.slug}`); setCopied(post.$id); setTimeout(() => setCopied(c => c === post.$id ? null : c), 1500) } catch { /* clipboard unavailable */ } }
  const renderCard = (post: Post, extra = '') => { const current = votes[post.$id]; const count = counts[post.$id]; return <article className={`card ${extra}`} key={post.$id} data-id={post.$id}><div className="photo"><img src={post.image_url} alt={post.title} /><strong className={post.is_premium === 'yes' ? 'exclusive' : 'free'}>{post.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong></div><div className="copy"><div><h2>{post.title}</h2><time>{timeAgo(post.created_at)}</time></div><p>{linkify(post.description, post.$id)}</p><footer><span><button className={current === 'like' ? 'selected like' : ''} onClick={() => vote(post, 'like')}><ThumbUp size={13} /> {count?.likes ?? 0}</button><button className={current === 'dislike' ? 'selected dislike' : ''} onClick={() => vote(post, 'dislike')}><ThumbDown size={13} /> {count?.dislikes ?? 0}</button></span><button className={copied === post.$id ? 'copied' : ''} onClick={() => copyLink(post)} title="Copy link" aria-label={`Copy link to ${post.title}`}>{copied === post.$id ? '✓' : '𝕏'}</button></footer></div></article> }
  const gotoPage = (p: number) => (e: React.MouseEvent<HTMLAnchorElement>) => { linkTo(`?page=${p}`)(e); window.scrollTo({ top: 0 }) }
  return <div className="nbh">
    <header><div className="bar"><button className={`hamburger ${menu ? 'open' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><i /><i /><i /></button><a className="logo" href="/" onClick={linkTo('/')}><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a><label className="search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search content..." aria-label="Search content" /><b>⌕</b></label></div></header>
    <aside className={`drawer ${menu ? 'show' : ''}`}>{navItems.map(x => <a key={x.label} href={x.path} onClick={e => { linkTo(x.path)(e as unknown as React.MouseEvent<HTMLAnchorElement>); setMenu(false) }}>{x.label}{x.badge && <small>NEW</small>}</a>)}</aside><button className={`shade ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} aria-label="Close navigation" />
    <main id="top"><section className="intro"><p>Fresh Drops</p><h1>What&apos;s <em>Hot</em> Right Now</h1><span>The freshest exclusive content — dropping daily.</span></section><div className="rule" />
    <section id="content" className="feed">{loading ? <p className="none">Loading drops…</p> : visible.length ? <>
      <div className="grid" ref={gridRef}>{visible.map(post => renderCard(post))}</div>
      {totalPages > 1 && <div className="pagination">
        <a href={`?page=${Math.max(1, page - 1)}`} onClick={gotoPage(Math.max(1, page - 1))} className={`pag-btn ${page <= 1 ? 'disabled' : ''}`}>← Prev</a>
        {(() => { const s = Math.max(1, page - 2); const e = Math.min(totalPages, page + 2); const els: React.ReactNode[] = []; if (s > 1) { els.push(<a key={1} href="?page=1" onClick={gotoPage(1)} className="pag-btn">1</a>); if (s > 2) els.push(<span key="dots1" className="pag-dots">…</span>) } for (let i = s; i <= e; i++) els.push(<a key={i} href={`?page=${i}`} onClick={gotoPage(i)} className={`pag-btn ${i === page ? 'active' : ''}`}>{i}</a>); if (e < totalPages) { if (e < totalPages - 1) els.push(<span key="dots2" className="pag-dots">…</span>); els.push(<a key={totalPages} href={`?page=${totalPages}`} onClick={gotoPage(totalPages)} className="pag-btn">{totalPages}</a>) } return els })()}
        <a href={`?page=${Math.min(totalPages, page + 1)}`} onClick={gotoPage(Math.min(totalPages, page + 1))} className={`pag-btn ${page >= totalPages ? 'disabled' : ''}`}>Next →</a>
      </div>}
    </> : <p className="none">No items found for “{query}”.</p>}</section></main>
  </div>
}
