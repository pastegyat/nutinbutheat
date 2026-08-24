import { useEffect, useMemo, useState } from 'react'
import './Categories.css'
import { getPublicPosts } from './lib/appwrite'
import { linkTo, navigate } from './lib/router'
import type { Post } from './types/post'

export default function Categories() {
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')
  const [posts, setPosts] = useState<Post[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await getPublicPosts()
      if (!cancelled) setPosts(list)
    })()
    return () => { cancelled = true }
  }, [])

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of posts) {
      const c = (p.category ?? '').trim()
      if (!c) continue
      map.set(c, (map.get(c) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total)
  }, [posts])

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`) }

  return <div className="categories-page">
    <header className="header">
      <div className="header-container">
        <div className="left-section">
          <button className={`hamburger ${menu ? 'active' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><span /><span /><span /></button>
          <a href="/" onClick={linkTo('/')} className="logo-link"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a>
        </div>
        <div className="search-container">
          <form onSubmit={submit} className="gf">
            <input type="text" className="search-input" placeholder="Search content..." value={q} onChange={e => setQ(e.target.value)} />
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

    <h1 className="page-title">📂 Categories</h1>
    <p className="page-subtitle">Browse all categories and discover posts by topic</p>

    <div className="categories-grid">
      {categories.length ? categories.map(cat => (
        <div key={cat.category} className="category-card">
          <a href={`/categories/${encodeURIComponent(cat.category)}`} onClick={linkTo(`/categories/${encodeURIComponent(cat.category)}`)}>{cat.category}</a>
          <p>{cat.total} posts</p>
        </div>
      )) : <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6b7684', padding: 40 }}>No categories yet.</p>}
    </div>
  </div>
}

