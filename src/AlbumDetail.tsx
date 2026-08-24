import { useEffect, useState, type ReactNode } from 'react'
import './AlbumDetail.css'
import { getAlbumBySlug } from './lib/appwrite'
import { linkTo } from './lib/router'
import type { Album, AlbumItem } from './types/album'

function linkifyTitle(text: string): ReactNode[] {
  const parts: ReactNode[] = []; let last = 0
  for (const m of text.matchAll(/(https?:\/\/[^\s<>"']+)/gi)) {
    const idx = m.index ?? 0
    if (idx > last) parts.push(text.slice(last, idx))
    parts.push(<a key={idx} href={m[0]} target="_blank" rel="noopener noreferrer" className="title-link">{m[0]}</a>)
    last = idx + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : [text]
}

export default function AlbumDetail({ slug }: { slug: string }) {
  const [album, setAlbum] = useState<Album | null | undefined>(undefined)
  const [items, setItems] = useState<AlbumItem[]>([])
  const [menu, setMenu] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await getAlbumBySlug(slug)
      if (cancelled) return
      if (!data) { setAlbum(null); return }
      setAlbum(data.album); setItems(data.items as AlbumItem[])
      if (data.album) {
        document.title = `${data.album.title} - NutinButHeat`
        const setMeta = (key: string, content: string) => {
          let el = document.querySelector(`meta[${key.startsWith('twitter') ? 'name' : 'property'}="${key}"]`) as HTMLMetaElement | null
          if (!el) { el = document.createElement('meta'); el.setAttribute(key.startsWith('twitter') ? 'name' : 'property', key); document.head.appendChild(el) }
          el.content = content
        }
        const desc = (data.album.description ?? '').slice(0, 120)
        setMeta('og:title', data.album.title)
        setMeta('og:description', desc)
        if (data.album.thumbnail) setMeta('og:image', data.album.thumbnail)
        setMeta('og:url', `https://nutinbutheat.com/a/${data.album.slug}`)
        setMeta('twitter:card', 'summary_large_image')
        setMeta('twitter:title', data.album.title)
        setMeta('twitter:description', desc)
        if (data.album.thumbnail) setMeta('twitter:image', data.album.thumbnail)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && lightboxIdx !== null) setLightboxIdx(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightboxIdx])

  useEffect(() => {
    document.body.style.overflow = lightboxIdx !== null ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [lightboxIdx])

  useEffect(() => {
    const videos = document.querySelectorAll<HTMLVideoElement>('.album-detail video')
    const onPlay = (ev: Event) => { videos.forEach(v => { if (v !== ev.target && !v.paused) v.pause() }) }
    videos.forEach(v => v.addEventListener('play', onPlay))
    return () => videos.forEach(v => v.removeEventListener('play', onPlay))
  }, [items])

  if (album === undefined) return <div className="album-detail"><p className="empty-state">Loading…</p></div>
  if (album === null) return <div className="album-detail"><p className="empty-state">Album not found.</p></div>

  const isPremium = album.is_premium === 'yes' || album.is_premium === true as unknown as string || String(album.is_premium) === '1'
  const lbItem = lightboxIdx !== null ? items[lightboxIdx] : null

  return (
    <div className="album-detail">
      <header className="header">
        <div className="header-container">
          <div className="left-section">
            <button className={`hamburger ${menu ? 'active' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><span /><span /><span /></button>
            <a href="/" onClick={linkTo('/')} className="logo-link"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a>
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

      {album.thumbnail ? (
        <div className="album-hero">
          <img src={album.thumbnail} className="album-hero-img" alt="" />
          <div className="album-hero-overlay">
            <span className={`album-badge ${isPremium ? 'premium' : 'free'}`}>{isPremium ? '★ Premium' : '✓ Free'}</span>
            <h1 className="album-title-hero">{album.title}</h1>
            {album.description && <p className="album-desc">{album.description}</p>}
            <p className="album-count">{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      ) : (
        <div style={{ background: '#1a1f2e', borderBottom: '1px solid #2a3441', padding: '28px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <span className={`album-badge ${isPremium ? 'premium' : 'free'}`} style={{ marginBottom: 10, display: 'inline-flex' }}>{isPremium ? '★ Premium' : '✓ Free'}</span>
            <h1 style={{ fontSize: 'clamp(20px,5vw,32px)', fontWeight: 800, marginBottom: 6 }}>{album.title}</h1>
            {album.description && <p style={{ fontSize: 14, color: '#b8c5d6', maxWidth: 600 }}>{album.description}</p>}
            <p style={{ fontSize: 13, color: '#6b7684', marginTop: 6 }}>{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="section-heading">
          All Items
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <a href="/albums" onClick={linkTo('/albums')}>Albums</a>
            <span className="sep">/</span>
            <span className="current">{album.title}</span>
          </nav>
          <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="items-grid">
          {items.length ? items.map((item, i) => (
            item.type === 'video' ? (
              <div key={item.$id} className="item-card video-card" data-idx={i}>
                <div className="player-wrap" id={`playerWrap-${i}`}>
                  <video id={`video-${i}`} controls preload="metadata" playsInline src={item.r2_url} poster={item.thumbnail || undefined} />
                  <span className="item-num">{i + 1}</span>
                  <span className="item-type-badge type-video">video</span>
                </div>
                {item.title && <div className="item-info"><div className="item-title">{linkifyTitle(item.title)}</div></div>}
              </div>
            ) : (
              <div key={item.$id} className="item-card image-card" onClick={() => setLightboxIdx(i)}>
                <div className="img-thumb">
                  {item.thumbnail && <img src={item.thumbnail} loading="lazy" alt="" />}
                  <div className="img-overlay"><div className="img-view-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div></div>
                  <span className="item-num">{i + 1}</span>
                  <span className="item-type-badge type-image">image</span>
                </div>
                {item.title && <div className="item-info"><div className="item-title" onClick={e => e.stopPropagation()}>{linkifyTitle(item.title)}</div></div>}
              </div>
            )
          )) : (
            <div className="empty-state"><div className="ei">🎞</div><p>No items in this album yet.</p></div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-content">
            <div className="footer-bio">
              <div className="footer-logo"><a href="/" onClick={linkTo('/')} className="logo-link"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a></div>
              <p className="footer-description">Your go-to platform for discovering and sharing amazing content from around the web. Join our community of creators and curators building the future of content discovery.</p>
              <div className="social-links">
                <a href="#" className="social-link" aria-label="Twitter"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg></a>
                <a href="#" className="social-link" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c2.793 0 3.127.01 4.237.061 1.02.047 1.574.218 1.94.361.487.189.835.415 1.2.78.366.366.592.714.782 1.202.143.365.314.92.361 1.94.05 1.11.061 1.444.061 4.237 0 2.793-.01 3.127-.061 4.237-.047 1.02-.218 1.574-.361 1.94-.189.487-.415.835-.782 1.2-.366.366-.713.592-1.2.782-.366.143-.92.314-1.94.361-1.11.05-1.444.061-4.237.061s-3.127-.01-4.237-.061c-1.02-.047-1.574-.218-1.94-.361-.487-.189-.835-.415-1.2-.782-.366-.366-.592-.713-.782-1.2-.143-.366-.314-.92-.361-1.94-.05-1.11-.061-1.444-.061-4.237s.01-3.127.061-4.237c.047-1.02.218-1.574.361-1.94.189-.487.415-.835.782-1.2.366-.366.713-.592 1.2-.782.366-.143.92-.314 1.94-.361 1.11-.05 1.444-.061 4.237-.061zm0-2c-2.84 0-3.195.012-4.314.062-1.126.05-1.896.229-2.569.49-.694.27-1.283.632-1.868 1.218-.585.585-.947 1.174-1.218 1.868-.26.673-.44 1.443-.49 2.569-.05 1.119-.062 1.474-.062 4.314s.012 3.195.062 4.314c.05 1.126.229 1.896.49 2.569.27.694.632 1.283 1.218 1.868.585.585 1.174.947 1.868 1.218.673.26 1.443.44 2.569.49 1.119.05 1.474.062 4.314.062s3.195-.012 4.314-.062c1.126-.05 1.896-.229 2.569-.49.694-.27 1.283-.632 1.868-1.218.585-.585.947-1.174 1.218-1.868.26-.673.44-1.443.49-2.569.05-1.119.062-1.474.062-4.314s-.012-3.195-.062-4.314c-.05-1.126-.229-1.896-.49-2.569-.27-.694-.632-1.283-1.218-1.868-.585-.585-1.174-.947-1.868-1.218-.673-.26-1.443-.44-2.569-.49-1.119-.05-1.474-.062-4.314-.062zm0 5.838c-2.403 0-4.357 1.954-4.357 4.357s1.954 4.357 4.357 4.357 4.357-1.954 4.357-4.357-1.954-4.357-4.357-4.357zm0 7.192c-1.564 0-2.835-1.271-2.835-2.835s1.271-2.835 2.835-2.835 2.835 1.271 2.835 2.835-1.271 2.835-2.835 2.835zm5.570-7.370c0 .561-.455 1.016-1.016 1.016s-1.016-.455-1.016-1.016.455-1.016 1.016-1.016 1.016.455 1.016 1.016z" /></svg></a>
              </div>
            </div>
            <div className="footer-nav">
              <a href="/about" className="footer-link">About</a>
              <a href="/terms" className="footer-link">Terms of Service</a>
              <a href="/contact" className="footer-link">Support</a>
            </div>
          </div>
          <div className="footer-bottom"><p>© 2026 NutinButHeat. All rights reserved.</p></div>
        </div>
      </footer>

      <div className={`modal-backdrop ${lightboxIdx !== null ? 'active' : ''}`} id="modalBackdrop" onClick={e => { if (e.target === e.currentTarget) setLightboxIdx(null) }}>
        <div className="modal-box">
          <button className="modal-close" onClick={() => setLightboxIdx(null)}>✕</button>
          {lbItem && <img id="modalImg" className="modal-img" src={lbItem.r2_url} alt="" />}
          <div className="modal-caption" id="modalCaption">{lbItem?.title ? linkifyTitle(lbItem.title) : ''}</div>
        </div>
      </div>
    </div>
  )
}


