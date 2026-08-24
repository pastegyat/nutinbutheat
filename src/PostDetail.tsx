import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './PostDetail.css'
import './SearchOverride.css'
import './RelatedCardDescription.css'
import type { Post } from './types/post'
import { getReactionCountsAll, getPostBySlug, getPublicPosts, toggleReaction, trackPageView, trackPostEvent, type ReactionCounts } from './lib/appwrite'
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
  const [vote, setVote] = useState<'like' | 'dislike' | undefined>(); const [reportOpen, setReportOpen] = useState(false); const [sent, setSent] = useState(false); const [copied, setCopied] = useState(false); const [menu, setMenu] = useState(false); const [query, setQuery] = useState('')
  const [rvotes, setRVotes] = useState<Record<string, 'like' | 'dislike' | undefined>>({}); const [copiedId, setCopiedId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null); const firedViews = useRef<Set<string>>(new Set())
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
    if (found.image_url) setMeta('og:image', found.image_url)
    setMeta('og:url', `https://nutinbutheat.com/${found.slug}`)
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', found.title)
    setMeta('twitter:description', (found.description ?? '').slice(0, 160))
    if (found.image_url) setMeta('twitter:image', found.image_url)
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
  const visible = useMemo(() => query ? posts.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())) : [], [posts, query])
  const castVote = async (type: 'like' | 'dislike') => { if (!post) return; const totals = await toggleReaction(post.$id, type); setCounts(c => ({ ...c, [post.$id]: totals })); setVote(v => v === type ? undefined : type) }
  const castRelated = async (id: string, type: 'like' | 'dislike') => { const totals = await toggleReaction(id, type); setCounts(c => ({ ...c, [id]: totals })); setRVotes(v => ({ ...v, [id]: v[id] === type ? undefined : type })) }
  const copyLink = async () => { if (!post) return; try { await navigator.clipboard.writeText(`${window.location.origin}/${post.slug}`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard unavailable */ } }
  const copyRelated = async (item: Post) => { try { await navigator.clipboard.writeText(`${window.location.origin}/${item.slug}`); setCopiedId(item.$id); setTimeout(() => setCopiedId(c => c === item.$id ? null : c), 1500) } catch { /* clipboard unavailable */ } }
  const close = () => { setReportOpen(false); setSent(false) }
  useEffect(() => {
    const grid = gridRef.current; if (!grid) return
    const seen = firedViews.current
    const observer = new IntersectionObserver(entries => { for (const entry of entries) { if (entry.isIntersecting) { const id = (entry.target as HTMLElement).dataset.id; if (id && !seen.has(id)) { seen.add(id); trackPostEvent(id, 'view') } } } }, { threshold: 0 })
    grid.querySelectorAll<HTMLElement>('[data-id]').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [query, related, visible])
  const renderCard = (item: Post) => { const current = rvotes[item.$id]; const count = counts[item.$id]; return <article className="card" key={item.$id} data-id={item.$id}><div className="photo"><img src={item.image_url} alt={item.title} /><strong className={item.is_premium === 'yes' ? 'exclusive' : 'free'}>{item.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong></div><div className="copy"><div><h2>{item.title}</h2><time>{timeAgo(item.created_at)}</time></div><p>{linkify(item.description, item.$id)}</p><footer><span><button className={current === 'like' ? 'selected like' : ''} onClick={() => castRelated(item.$id, 'like')}><ThumbUp size={13} /> {count?.likes ?? 0}</button><button className={current === 'dislike' ? 'selected dislike' : ''} onClick={() => castRelated(item.$id, 'dislike')}><ThumbDown size={13} /> {count?.dislikes ?? 0}</button></span><button className={copiedId === item.$id ? 'copied' : ''} onClick={() => copyRelated(item)} title="Copy link" aria-label={`Copy link to ${item.title}`}>{copiedId === item.$id ? '✓' : '𝕏'}</button></footer></div></article> }
  return <div className="detail-page">
    <header className="detail-header"><div className="detail-bar"><button className={`detail-hamburger ${menu ? 'open' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><i /><i /><i /></button><a href="/" onClick={linkTo('/')} className="detail-logo"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a><label className="detail-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search content..." aria-label="Search content" /><b>⌕</b></label></div></header>
    <aside className={`detail-drawer ${menu ? 'show' : ''}`}>{navItems.map(item => <a key={item.label} href={item.path} onClick={e => { linkTo(item.path)(e as unknown as React.MouseEvent<HTMLAnchorElement>); setMenu(false) }}>{item.label}{item.badge && <small>NEW</small>}</a>)}</aside><button className={`detail-shade ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} aria-label="Close navigation" />
    <main className="detail-main">{query ? <section className="search-results"><div className="related-heading"><p>Search results for “{query}”</p><h1>Matching drops</h1></div>{visible.length ? <div className="related-grid" ref={gridRef}>{visible.map(renderCard)}</div> : <p className="no-results">No posts match your search.</p>}</section> : post === undefined ? <p className="no-results">Loading…</p> : !post ? <p className="no-results">Post not found.</p> : <>
      <article className="main-post">
        <div className="main-image"><img src={post.image_url} alt={post.title} /><strong>{post.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong></div>
        <div className="main-copy"><div className="main-title"><div><p className="detail-kicker">{post.category} · Featured drop</p><h1>{post.title}</h1></div><time>{timeAgo(post.created_at)}</time></div><p className="main-description">{linkify(post.description, post.$id)}</p><div className="main-actions"><div><button className={vote === 'like' ? 'active like' : ''} onClick={() => castVote('like')}><ThumbUp size={14} /> {counts[post.$id]?.likes ?? 0}</button><button className={vote === 'dislike' ? 'active dislike' : ''} onClick={() => castVote('dislike')}><ThumbDown size={14} /> {counts[post.$id]?.dislikes ?? 0}</button></div><div><button className={copied ? 'copied' : ''} onClick={copyLink} title="Copy link" aria-label="Copy link to this post">{copied ? '✓' : '𝕏'}</button><button className="report" onClick={() => setReportOpen(true)}>🚩 Report</button></div></div></div>
      </article>
      {visibleRelated.length > 0 && <section className="related"><div className="related-heading"><p>Keep exploring</p><h2>More fresh drops</h2></div><div className="related-grid related-endless" ref={gridRef}>{visibleRelated.map(renderCard)}</div>{relatedCount < related.length && <div ref={relatedSentinelRef} style={{ minHeight: 1 }}><p className="no-results" style={{ padding: '24px 0', textAlign: 'center' }}>Loading more…</p></div>}</section>}</>}
    </main>
    {reportOpen && <div className="modal-layer" role="presentation"><button className="modal-backdrop" onClick={close} aria-label="Close report dialog" /><form className="report-dialog" onSubmit={e => { e.preventDefault(); setSent(true) }}><button type="button" className="modal-close" onClick={close}>×</button><h2>{sent ? 'Report submitted' : 'Report post'}</h2>{sent ? <p>Thanks for helping keep the community safe.</p> : <><label htmlFor="reason">Tell us what happened</label><textarea id="reason" required placeholder="Reason for reporting..." /><button type="submit" className="submit-report">Submit report</button></>}</form></div>}
  </div>
}
