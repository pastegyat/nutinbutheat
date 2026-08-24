import { useEffect, useState } from 'react'
import './About.css'
import { linkTo, navigate } from './lib/router'

export default function About() {
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.about-page .content-section, .about-page .mission-card, .about-page .cta-section')
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; ;(el as unknown as Record<string, unknown>).transition = 'opacity 0.6s ease, transform 0.6s ease' as unknown as string })
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.transform = 'translateY(0)' } }) }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`) }

  return <div className="about-page">
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

    <div className="about-container">
      <div className="hero-section">
        <span className="fire-icon">🔥</span>
        <h1 className="main-title">About NutinButHeat.com</h1>
        <h2 className="main-subtitle">The Home of Viral, Shareable Content</h2>
        <p className="intro-text">
          NutinButHeat.com is your ultimate destination to discover the hottest content lighting up the internet.
          From trending videos and exclusive hard to find videos all in one place.
          if it's 🔥, you'll find it here.
        </p>
        <div className="tagline">
          We're not just another content platform. We're your shortcut to the best of the web, curated and delivered in one place.
        </div>
      </div>

      <div className="content-section">
        <h2 className="section-title"><span className="section-icon">🔥</span> What You Can Do on NutinButHeat</h2>
        <div className="feature-grid">
          <div className="feature-item"><span className="feature-icon">👀</span><h3 className="feature-title">Browse</h3><p className="feature-description">Dive into a constantly updated stream of the most engaging content online.</p></div>
          <div className="feature-item"><span className="feature-icon">❤️</span><h3 className="feature-title">Like</h3><p className="feature-description">Show some love for the posts that speak to you.</p></div>
          <div className="feature-item"><span className="feature-icon">📤</span><h3 className="feature-title">Share</h3><p className="feature-description">Spread the heat across your social circles with easy sharing tools.</p></div>
          <div className="feature-item"><span className="feature-icon">🔍</span><h3 className="feature-title">Discover</h3><p className="feature-description">Find new trends, hidden gems, and content you didn't even know you needed.</p></div>
        </div>
      </div>

      <div className="content-section">
        <h2 className="section-title"><span className="section-icon">🚫</span> What You <span className="highlight-text">Can't</span> Do (On Purpose)</h2>
        <p style={{ color: '#b8c5d6', fontSize: 18, marginBottom: 24 }}>
          On NutinButHeat, there's <strong className="highlight-text">no uploading</strong>. That's right — we do the heavy lifting
          by curating content from across the internet so you don't have to. Our focus is on delivering high-quality,
          high-impact content that's worth your time.
        </p>
        <ul className="restrictions-list">
          <li>No spam</li>
          <li>No noise</li>
          <li>No user uploads</li>
          <li>No low-quality content</li>
        </ul>
        <p style={{ color: '#ffffff', fontSize: 20, fontWeight: 600, textAlign: 'center', marginTop: 32 }}>Just straight 🔥.</p>
      </div>

      <div className="mission-card">
        <h2 className="section-title" style={{ justifyContent: 'center', marginBottom: 24 }}><span className="section-icon">🎯</span> Our Mission</h2>
        <p className="mission-text">To fuel your digital downtime with content that informs, entertains, and connects. We exist to surface what's trending, what's funny, and what's worth sharing — all in one place.</p>
      </div>

      <div className="content-section">
        <h2 className="section-title"><span className="section-icon">💫</span> Why NutinButHeat?</h2>
        <div style={{ color: '#b8c5d6', fontSize: 18, lineHeight: 1.7 }}>
          <p style={{ marginBottom: 16 }}>Because scrolling shouldn't feel like work.</p>
          <p style={{ marginBottom: 16 }}>Because great content deserves to be seen.</p>
          <p>Because you've got good taste — and we've got the content to match.</p>
        </div>
      </div>

      <div className="cta-section">
        <h2 className="cta-title">Ready to Get Started?</h2>
        <p className="cta-text"><strong>Stop searching. Start scrolling.</strong><br />The content you'll love is already here.</p>
        <a href="/" onClick={linkTo('/')} className="cta-button">Explore NutinButHeat 🔥</a>
      </div>
    </div>
  </div>
}


