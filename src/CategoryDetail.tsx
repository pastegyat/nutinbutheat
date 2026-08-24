import { useEffect, useMemo, useState, type ReactNode } from 'react'
import './CategoryDetail.css'
import type { Post } from './types/post'
import { fetchReactionCounts, getPublicPosts, toggleReaction, trackPageView, trackPostEvent } from './lib/appwrite'
import { timeAgo } from './lib/format'
import { linkTo } from './lib/router'

function getPage(): number {
  const sp = new URLSearchParams(window.location.search)
  return Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
}

export default function CategoryDetail({ category }: { category: string }) {
  const [menu, setMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [counts, setCounts] = useState<Record<string, { likes: number; dislikes: number }>>({})
  const [votes, setVotes] = useState<Record<string, 'like' | 'dislike' | undefined>>({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(() => getPage())

  useEffect(() => {
    const sync = () => setPage(getPage())
    window.addEventListener('popstate', sync)
    window.addEventListener('nbh:navigate', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('nbh:navigate', sync) }
  }, [])

  const perPage = 6
  const linkify = (text: string, postId?: string) => { const parts: ReactNode[] = []; let last = 0; for (const m of text.matchAll(/(https?:\/\/\S+)/g)) { const idx = m.index ?? 0; if (idx > last) parts.push(text.slice(last, idx)); parts.push(<a key={idx} href={m[0]} target="_blank" rel="noopener noreferrer" onClick={postId ? () => trackPostEvent(postId, 'link_click') : undefined}>{m[0]}</a>); last = idx + m[0].length } if (last < text.length) parts.push(text.slice(last)); return parts }

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      setLoading(true)
      ;(async () => {
        const list = await getPublicPosts()
        if (cancelled) return
        const filtered = list.filter(p => (p.category ?? '') === category).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        if (cancelled) return
        setPosts(filtered); setLoading(false)
        const totals = await Promise.all(filtered.map(async p => [p.$id, await fetchReactionCounts(p.$id)] as const))
        if (cancelled) return
        setCounts(Object.fromEntries(totals))
      })()
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [category])

  const filteredPosts = useMemo(() => posts.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(searchQuery.toLowerCase())), [posts, searchQuery])
  const totalPosts = filteredPosts.length
  const totalPages = Math.ceil(totalPosts / perPage)
  const visible = useMemo(() => filteredPosts.slice((page - 1) * perPage, page * perPage), [filteredPosts, page])

  useEffect(() => { const t = setTimeout(() => setPage(1), 0); return () => clearTimeout(t) }, [category, searchQuery])
  useEffect(() => { const term = searchQuery.trim(); if (!term) return; const t = setTimeout(() => trackPageView(location.pathname + location.search, term), 600); return () => clearTimeout(t) }, [searchQuery])

  const vote = async (post: Post, type: 'like' | 'dislike') => {
    const current = votes[post.$id]
    const totals = await toggleReaction(post.$id, type)
    setCounts(c => ({ ...c, [post.$id]: totals }))
    setVotes(v => ({ ...v, [post.$id]: current === type ? undefined : type }))
  }

  const submit = (e: React.FormEvent) => { e.preventDefault() }

  return <div className="category-page">
    <header className="header">
      <div className="header-container">
        <div className="left-section">
          <button className={`hamburger ${menu ? 'active' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><span /><span /><span /></button>
          <a href="/" onClick={linkTo('/')} className="logo-link"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a>
        </div>
        <div className="search-container">
          <form onSubmit={submit} className="fs">
            <input type="text" className="search-input" placeholder={`Search in ${category}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} aria-label={`Search in ${category}`} />
            <button type="submit" className="search-btn" aria-label="Search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg></button>
          </form>
        </div>
      </div>
    </header>

    <div className={`slide-menu ${menu ? 'active' : ''}`}>
      <div className="menu-content">
        <ul className="menu-nav">
          <li><a href="/" onClick={linkTo('/')}>Home</a></li>
          <li><a href="/albums" onClick={linkTo('/albums')}>Albums</a></li>
          <li><a href="/trending" onClick={linkTo('/trending')}>Trending</a></li>
          <li><a href="/categories" onClick={linkTo('/categories')}>Categories</a></li>
          <li><a href="/about" onClick={linkTo('/about')}>About</a></li>
          <li><a href="/terms" onClick={linkTo('/terms')}>Terms of Service</a></li>
          <li><a href="/contact" onClick={linkTo('/contact')}>Contact</a></li>
          <li><a href="/privacy" onClick={linkTo('/privacy')}>Privacy</a></li>
        </ul>
      </div>
    </div>
    <div className={`overlay ${menu ? 'active' : ''}`} onClick={() => setMenu(false)} />

    <div className="category-heading">Category: <span>{category}</span></div>
    <div className="category-count">{totalPosts} post{totalPosts !== 1 ? 's' : ''} found</div>

    <main className="main-content">
      <div className="cards-grid">
        {loading ? <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6b7684', padding: 40 }}>Loading…</p>
          : visible.length ? visible.map(post => {
            const c = counts[post.$id] ?? { likes: 0, dislikes: 0 }
            const cur = votes[post.$id]
            return <div key={post.$id} className="media-card">
              <div className="card-image-wrapper"><img src={post.image_url} className="card-image" alt={post.title} /></div>
              <div className="card-content">
                <div className="card-header"><div className="card-name">{post.title}</div><div className="card-date">{timeAgo(post.created_at)}</div></div>
                <div className="card-description">{linkify(post.description, post.$id)}</div>
                <div className="card-actions">
                  <div className="vote-buttons">
                    <button className={`vote-btn like ${cur === 'like' ? 'active like' : ''}`} onClick={() => vote(post, 'like')}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" /></svg> <span>{c.likes}</span></button>
                    <button className={`vote-btn dislike ${cur === 'dislike' ? 'active dislike' : ''}`} onClick={() => vote(post, 'dislike')}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.73 5.25h1.035A7.465 7.465 0 0118 9.375a7.465 7.465 0 01-1.235 4.125h-.148c-.806 0-1.534.446-2.031 1.08a9.04 9.04 0 01-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 00-.322 1.672V21a.75.75 0 01-.75.75 2.25 2.25 0 01-2.25-2.25c0-1.152.26-2.243.723-3.218C7.74 15.724 7.366 15 6.748 15H3.622c-1.026 0-1.945-.694-2.054-1.715A12.134 12.134 0 011.5 12c0-2.848.992-5.464 2.649-7.521C4.537 3.997 5.136 3.75 5.754 3.75H9.77a4.5 4.5 0 011.423.23l3.114 1.04a4.5 4.5 0 001.423.23zM21.669 14.023c.536-1.362.831-2.845.831-4.398 0-1.22-.182-2.398-.52-3.507-.26-.85-1.084-1.368-1.973-1.368H19.1c-.445 0-.72.498-.523.898.591 1.2.924 2.55.924 3.977a8.958 8.958 0 01-1.302 4.666c-.245.403.028.959.5.959h1.053c.832 0 1.612-.453 1.918-1.227z" /></svg> <span>{c.dislikes}</span></button>
                  </div>
                  <div className="action-buttons"><button className="action-btn report-btn">🚩 Report</button></div>
                </div>
              </div>
            </div>
          }) : <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6b7684' }}>No posts found in this category.</p>}
      </div>
    </main>

    {totalPages > 1 && (
      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
          <a key={p} href={`/categories/${encodeURIComponent(category)}?page=${p}`} onClick={linkTo(`/categories/${encodeURIComponent(category)}?page=${p}`)} className={p === page ? 'active' : ''}>{p}</a>
        ))}
      </div>
    )}
  </div>
}

