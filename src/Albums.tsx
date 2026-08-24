import { useEffect, useState } from 'react'
import './Albums.css'
import { getAlbums } from './lib/appwrite'
import { timeAgo } from './lib/format'
import { linkTo } from './lib/router'
import type { Album } from './types/album'

function getPage() {
  const sp = new URLSearchParams(window.location.search)
  return Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
}

export default function Albums() {
  const [menu, setMenu] = useState(false)
  const [page, setPage] = useState(() => getPage())
  const [input, setInput] = useState(() => (new URLSearchParams(window.location.search).get('q') ?? '').trim())
  const [q, setQ] = useState(() => (new URLSearchParams(window.location.search).get('q') ?? '').trim())
  const [albums, setAlbums] = useState<Album[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sync = () => setPage(getPage())
    window.addEventListener('popstate', sync)
    window.addEventListener('nbh:navigate', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('nbh:navigate', sync) }
  }, [])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.has('q')) {
      sp.delete('q')
      const qs = sp.toString()
      history.replaceState(null, '', qs ? `/albums?${qs}` : '/albums')
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => { const t = setTimeout(() => setPage(1), 0); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      setLoading(true)
      ;(async () => {
        const data = await getAlbums(page, q)
        if (cancelled) return
        setAlbums(data.albums); setTotal(data.total); setLoading(false)
      })()
    }, 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [page, q])

  const perPage = 20
  const totalPages = Math.ceil(total / perPage)
  const base = '?'

  const submit = (e: React.FormEvent) => { e.preventDefault() }

  return (
    <div className="albums-page">
      <header className="header">
        <div className="header-container">
          <div className="left-section">
            <button className={`hamburger ${menu ? 'active' : ''}`} id="hamburger" onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><span /><span /><span /></button>
            <a href="/" onClick={linkTo('/')} className="logo-link"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a>
          </div>
          <div className="search-wrap">
            <form className="search-form" onSubmit={submit}>
              <input type="text" name="q" placeholder="Search albums..." value={input} onChange={e => setInput(e.target.value)} />
              <button type="submit" aria-label="Search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className={`slide-menu ${menu ? 'active' : ''}`} id="slideMenu">
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
      <div className={`overlay ${menu ? 'active' : ''}`} id="overlay" onClick={() => setMenu(false)} />

      <main className="main-content">
        <div className="page-heading">
          <div>
            <h1>Albums</h1>
            {q && <p>Results for &quot;{q}&quot;</p>}
          </div>
          {q && <a href="#" onClick={e => { e.preventDefault(); setInput('') }} style={{ fontSize: 13, color: '#ff6b35', textDecoration: 'none', fontWeight: 600 }}>✕ Clear</a>}
        </div>

        {loading ? <div className="no-results"><div className="no-results-icon">🎞</div><h2>Loading…</h2></div>
          : (
            <div className="albums-grid">
              {albums.length ? albums.map(album => {
                const cover = (album.cover || album.thumbnail || '') as string
                const isPremium = album.is_premium === 'yes' || album.is_premium === true as unknown as string || String(album.is_premium) === '1'
                return (
                  <a key={album.$id} href={`/a/${encodeURIComponent(album.slug)}`} onClick={linkTo(`/a/${album.slug}`)} className="album-card">
                    <div className="album-mosaic">
                      {cover ? <img src={cover} className="mosaic-single" loading="lazy" alt="" /> : <div className="mosaic-placeholder">🎞</div>}
                      {isPremium && <span className="prem-badge">★ Premium</span>}
                      <div className="album-mosaic-overlay">
                        {(album.video_count ?? 0) > 0 && <span className="count-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg> {album.video_count}</span>}
                        {(album.image_count ?? 0) > 0 && <span className="count-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> {album.image_count}</span>}
                      </div>
                    </div>
                    <div className="album-info">
                      <div className="album-title">{album.title}</div>
                      <div className="album-meta">
                        <span className="meta-item">{album.item_count ?? 0} item{(album.item_count ?? 0) !== 1 ? 's' : ''}</span>
                        <span className="meta-dot">•</span>
                        <span className="meta-item">{timeAgo(album.created_at)}</span>
                      </div>
                    </div>
                  </a>
                )
              }) : (
                <div className="no-results">
                  <div className="no-results-icon">🎞</div>
                  <h2>No albums found</h2>
                  <p>{q ? 'Try a different search.' : 'No albums have been created yet.'}</p>
                </div>
              )}
            </div>
          )}

        {totalPages > 1 && (
          <div className="pagination">
            <a href={`${base}page=${Math.max(1, page - 1)}`} onClick={linkTo(`${base}page=${Math.max(1, page - 1)}`)} className={`pag-btn ${page <= 1 ? 'disabled' : ''}`}>← Prev</a>
            {(() => {
              const s = Math.max(1, page - 2); const e = Math.min(totalPages, page + 2)
              const els: React.ReactNode[] = []
              if (s > 1) { els.push(<a key={1} href={`${base}page=1`} onClick={linkTo(`${base}page=1`)} className="pag-btn">1</a>); if (s > 2) els.push(<span key="dots1" className="pag-dots">…</span>) }
              for (let i = s; i <= e; i++) els.push(<a key={i} href={`${base}page=${i}`} onClick={linkTo(`${base}page=${i}`)} className={`pag-btn ${i === page ? 'active' : ''}`}>{i}</a>)
              if (e < totalPages) { if (e < totalPages - 1) els.push(<span key="dots2" className="pag-dots">…</span>); els.push(<a key={totalPages} href={`${base}page=${totalPages}`} onClick={linkTo(`${base}page=${totalPages}`)} className="pag-btn">{totalPages}</a>) }
              return els
            })()}
            <a href={`${base}page=${Math.min(totalPages, page + 1)}`} onClick={linkTo(`${base}page=${Math.min(totalPages, page + 1)}`)} className={`pag-btn ${page >= totalPages ? 'disabled' : ''}`}>Next →</a>
          </div>
        )}
      </main>
    </div>
  )
}


