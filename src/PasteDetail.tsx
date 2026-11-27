import { ChristmasHat } from './ChristmasEffects'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './PostDetail.css'
import './PasteDetail.css'
import type { Post } from './types/post'
import { getReactionCountsAll, getPasteBySlug, getPublicPosts, toggleReaction, trackPostEvent, trackPostViews, clearReactionCountsCache, type Paste, type ReactionCounts } from './lib/appwrite'
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

export default function PasteDetail({ slug = '', initialPaste = null }: { slug?: string; initialPaste?: Paste | null }) {
  const [paste, setPaste] = useState<Paste | null | undefined>(initialPaste ?? undefined)
  const [posts, setPosts] = useState<Post[]>([])
  const [counts, setCounts] = useState<Record<string, ReactionCounts>>({})
  const [rvotes, setRVotes] = useState<Record<string, 'like' | 'dislike' | undefined>>({})
  const [copied, setCopied] = useState(false)
  const [menu, setMenu] = useState(false); const [query, setQuery] = useState('')
  const [relatedCount, setRelatedCount] = useState(5)

  // Paste-page ad tags: head script injected only while a paste result is shown.
  useEffect(() => {
    if (!paste) return
    const headScript = document.createElement('script')
    headScript.src = 'https://pl29243399.profitableratecpmnetwork.com/b1/22/17/b122176ffebbabd8fabde28147e30582.js'
    headScript.dataset.pasteAds = 'true'
    document.head.appendChild(headScript)
    return () => { headScript.remove() }
  }, [paste?.slug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Skip the paste fetch when the resolver already loaded it —
      // GET /pastes/:slug counts +1 per call, so refetching double-counts.
      let current = initialPaste
      if (!current) {
        current = slug ? await getPasteBySlug(slug) : null
        if (cancelled) return
        setPaste(current)
      }
      const [list, countsAll] = await Promise.all([getPublicPosts(), getReactionCountsAll()])
      if (cancelled) return
      setPosts(list); setCounts(countsAll)
      const found = current
      if (found) {
        document.title = `${found.title || 'Paste'} - NutinButHeat`
        const setMeta = (key: string, content: string) => {
          let el = document.querySelector(`meta[${key.startsWith('twitter') ? 'name' : 'property'}="${key}"]`) as HTMLMetaElement | null
          if (!el) { el = document.createElement('meta'); el.setAttribute(key.startsWith('twitter') ? 'name' : 'property', key); document.head.appendChild(el) }
          el.content = content
        }
        setMeta('og:type', 'article')
        setMeta('og:title', found.title || 'Paste')
        setMeta('og:description', (found.content ?? '').slice(0, 160))
        setMeta('og:url', `https://nutinbutheat.com/${found.slug}`)
        setMeta('twitter:card', 'summary_large_image')
        setMeta('twitter:title', found.title || 'Paste')
        setMeta('twitter:description', (found.content ?? '').slice(0, 160))
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  const related = useMemo(() => posts, [posts])
  useEffect(() => { const t = setTimeout(() => setRelatedCount(5), 0); return () => clearTimeout(t) }, [slug])
  const visibleRelated = useMemo(() => related.slice(0, relatedCount), [related, relatedCount])

  const relatedSentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (query) return
    if (relatedCount >= related.length) return
    const el = relatedSentinelRef.current; if (!el) return
    const obs = new IntersectionObserver(entries => { if (entries[0].isIntersecting) setRelatedCount(c => Math.min(c + 5, related.length)) }, { rootMargin: '800px' })
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

  // Scroll-pass view counting for related posts (same as post detail page).
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

  const castRelated = async (id: string, type: 'like' | 'dislike') => { const totals = await toggleReaction(id, type); clearReactionCountsCache(); setCounts(c => ({ ...c, [id]: totals })); setRVotes(v => ({ ...v, [id]: v[id] === type ? undefined : type })) }
  const copyUrl = async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/${paste?.slug ?? slug}`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard unavailable */ } }
  const visible = useMemo(() => query ? posts.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase())) : [], [posts, query])
  const renderCard = (item: Post) => { const current = rvotes[item.$id]; const count = counts[item.$id]; return <article className="card" key={item.$id} data-id={item.$id}><div className="photo"><img src={item.image_url} alt={item.title} /><strong className={item.is_premium === 'yes' ? 'exclusive' : 'free'}>{item.is_premium === 'yes' ? '★ Exclusive' : '✓ Free'}</strong></div><div className="copy"><div><h2>{item.title}</h2><time>{timeAgo(item.created_at)}</time></div><p>{linkify(item.description, item.$id)}</p><footer><span><button className={current === 'like' ? 'selected like' : ''} onClick={() => castRelated(item.$id, 'like')}><ThumbUp size={13} /> {count?.likes ?? 0}</button><button className={current === 'dislike' ? 'selected dislike' : ''} onClick={() => castRelated(item.$id, 'dislike')}><ThumbDown size={13} /> {count?.dislikes ?? 0}</button></span><span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><a href="https://x.com/nutinbutheat2" target="_blank" rel="noopener noreferrer" className="x-link" aria-label="X"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M18.9 1H22.2L14 10.2 23.4 22H17L12.4 16.2 6.9 22H3.6L12.1 12.4 3 1H9.6L13.6 6.1 18.9 1ZM16.2 20.1H18L8.3 2.9H6.5L16.2 20.1Z"/></svg></a></span></footer></div></article> }

  return <div className="detail-page">
    <header className="detail-header"><div className="detail-bar"><button className={`detail-hamburger ${menu ? 'open' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><ChristmasHat /><i /><i /><i /></button><a href="/" onClick={linkTo('/')} className="detail-logo"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a><label className="detail-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search content..." aria-label="Search content" /><b>⌕</b></label></div></header>
    <aside className={`detail-drawer ${menu ? 'show' : ''}`}>{navItems.map(item => <a key={item.label} href={item.path} onClick={e => { linkTo(item.path)(e as unknown as React.MouseEvent<HTMLAnchorElement>); setMenu(false) }}>{item.label}{item.badge && <small>NEW</small>}</a>)}</aside><button className={`detail-shade ${menu ? 'show' : ''}`} onClick={() => setMenu(false)} aria-label="Close navigation" />
    <main className="detail-main">{query ? <section className="search-results"><div className="related-heading"><p>Search results for “{query}”</p><h1>Matching drops</h1></div>{visible.length ? <div className="related-grid">{visible.map(renderCard)}</div> : <p className="no-results">No posts match your search.</p>}</section> : paste === undefined ? <p className="no-results">Loading…</p> : !paste ? <p className="no-results">Paste not found.</p> : <>
      <article className="paste-block">
        <div className="paste-head"><div><p className="detail-kicker">Text paste</p><h1>{paste.title || 'Untitled paste'}</h1></div><button className={copied ? 'copied' : ''} onClick={copyUrl} title="Copy link" aria-label="Copy link to this paste">{copied ? '✓ Copied' : '⧉ Copy link'}</button></div>
        <div className="paste-body">{linkify(paste.content)}</div>
      </article>
      <script async data-cfasync="false" src="https://pl29243363.profitableratecpmnetwork.com/81b0dd12abd9635697ae2ed06b6e0f73/invoke.js" />
      <div id="container-81b0dd12abd9635697ae2ed06b6e0f73" />
      {visibleRelated.length > 0 && <section className="related"><div className="related-heading"><p>Keep exploring</p><h2>More fresh drops</h2></div><div className="related-grid related-endless" ref={relatedGridRef}>{visibleRelated.map(renderCard)}</div>{relatedCount < related.length && <div ref={relatedSentinelRef} style={{ minHeight: 1 }}><p className="no-results" style={{ padding: '24px 0', textAlign: 'center' }}>Loading more…</p></div>}</section>}</>}
    </main>
  </div>
}

