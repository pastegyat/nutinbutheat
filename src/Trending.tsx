import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './Home.css'
import './Trending.css'
import type { Post } from './types/post'
import { fetchReactionCounts, getPublicPosts, trackPostEvent } from './lib/appwrite'
import { timeAgo } from './lib/format'
import { linkTo } from './lib/router'

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Albums', path: '/albums' },
  { label: 'Trending', path: '/trending' },
  { label: 'Categories', path: '/categories' },
  { label: 'About', path: '/about' },
  { label: 'Terms of Service', path: '/terms' },
  { label: 'Contact', path: '/contact' },
  { label: 'Privacy', path: '/privacy' },
]
const linkify = (text: string, postId?: string) => { const parts: ReactNode[] = []; let last = 0; for (const match of text.matchAll(/(https?:\/\/\S+)/g)) { const idx = match.index ?? 0; if (idx > last) parts.push(text.slice(last, idx)); parts.push(<a key={idx} href={match[0]} target="_blank" rel="noopener noreferrer" onClick={postId ? () => trackPostEvent(postId, 'link_click') : undefined}>{match[0]}</a>); last = idx + match[0].length } if (last < text.length) parts.push(text.slice(last)); return parts }

type ScoredPost = Post & { likes: number; dislikes: number; score: number }

const PER = 12
export default function Trending() {
  const [menu, setMenu] = useState(false); const [posts, setPosts] = useState<ScoredPost[]>([]); const [loading, setLoading] = useState(true); const [visibleCount, setVisibleCount] = useState(PER)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await getPublicPosts()
      if (cancelled) return
      const totals = await Promise.all(list.map(async p => [p.$id, await fetchReactionCounts(p.$id)] as const))
      if (cancelled) return
      const map = Object.fromEntries(totals) as Record<string, { likes: number; dislikes: number }>
      const scored: ScoredPost[] = list.map(p => {
        const c = map[p.$id] ?? { likes: 0, dislikes: 0 }
        const views = Number(p.views) || 0
        const score = views + c.likes * 8 - c.dislikes * 2
        return { ...p, likes: c.likes, dislikes: c.dislikes, score }
      })
      scored.sort((a, b) => b.score - a.score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPosts(scored); setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const displayed = useMemo(() => posts.slice(0, visibleCount), [posts, visibleCount])
  const gridRef = useRef<HTMLDivElement>(null); const firedViews = useRef<Set<string>>(new Set())
  useEffect(() => {
    const grid = gridRef.current; if (!grid) return
    const seen = firedViews.current
    const observer = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.isIntersecting) { const id = (entry.target as HTMLElement).dataset.id; if (id && !seen.has(id)) { seen.add(id); trackPostEvent(id, 'view') } } } }, { threshold: 0 })
    grid.querySelectorAll<HTMLElement>('[data-id]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [displayed])
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (visibleCount >= posts.length) return
    const el = sentinelRef.current; if (!el) return
    const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) setVisibleCount(c => Math.min(c + PER, posts.length)) }, { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visibleCount, posts.length])

  return <div className="nbh trending-page">
    <header><div className="bar"><button className={`hamburger ${menu ? 'open' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><i /><i /><i /></button><a className="logo" href="/" onClick={linkTo('/')}><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a></div></header>
    <aside className={`drawer ${menu ? 'show' : ''}`}>{navItems.map(x => <a key={x.label} href={x.path} onClick={e => { linkTo(x.path)(e as unknown as React.MouseEvent<HTMLAnchorElement>); setMenu(false) }}>{x.label}{x.label === 'Albums' && <small>NEW</small>}</a>)}</aside><button className={`shade ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} aria-label="Close navigation" />
    <main id="top">
      <section className="trending-intro"><p>Trending Now</p><h1>Most <em>Loved</em> Drops</h1><span>Ranked by likes + views — updated live.</span></section>
      <div className="rule" />
      <section className="feed">
        {loading ? <p className="none">Loading trending…</p> : posts.length === 0 ? <p className="none">No posts yet.</p> : <><div className="grid trending-grid" ref={gridRef}>{displayed.map((post, idx) => (
          <article className="card trending-card" key={post.$id} data-id={post.$id}>
            <div className="photo"><img src={post.image_url} alt={post.title} /><strong className={post.is_premium === 'yes' ? 'exclusive' : 'free'}>{post.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong><span className="rank-badge">#{idx + 1}</span></div>
            <div className="copy trending-copy"><div><h2>{post.title}</h2><time>{timeAgo(post.created_at)}</time></div><p>{linkify(post.description, post.$id)}</p></div>
          </article>
        ))}</div><div ref={sentinelRef} className="trending-sentinel">{visibleCount < posts.length ? <p className="none" style={{ padding: '24px 0' }}>Loading more…</p> : <p className="none" style={{ padding: '24px 0', color: '#3a4451' }}>— End —</p>}</div></>}
      </section>
    </main>
  </div>
}


