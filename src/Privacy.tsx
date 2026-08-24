import { useEffect, useState } from 'react'
import './Privacy.css'
import { linkTo, navigate } from './lib/router'

export default function Privacy() {
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.privacy-page .privacy-section, .privacy-page .toc-section')
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; el.style.transition = 'opacity 0.6s ease, transform 0.6s ease' })
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.transform = 'translateY(0)' } }) }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.privacy-section')
    const links = document.querySelectorAll<HTMLAnchorElement>('.toc-link')
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { const id = e.target.getAttribute('id'); links.forEach(l => { l.style.color = l.getAttribute('href') === `#${id}` ? '#ff6b35' : '' }) } }) }, { threshold: 0.7, rootMargin: '-80px 0px -50% 0px' })
    sections.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`) }

  return <div className="privacy-page">
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

    <div className="privacy-container">
      <div className="hero-section">
        <span className="privacy-icon">🔒</span>
        <h1 className="main-title">Privacy Policy</h1>
        <p className="effective-date"><strong>Effective Date:</strong> December 15, 2024</p>
        <div className="intro-text">
          At <strong className="highlight-text">NutinButHeat.com</strong> ("NutinButHeat", "we", "us", or "our"), your privacy matters.
          This Privacy Policy outlines how we collect, use, and protect your information when you use our website.<br /><br />
          <strong>By accessing or using NutinButHeat.com, you agree to the practices described in this policy.</strong>
        </div>
        <div className="trust-badge"><span className="trust-icon">🛡️</span><p className="trust-text">We keep things simple. Minimal data, maximum privacy.</p></div>
      </div>

      <div className="toc-section">
        <h2 className="toc-title"><span>📋</span> Quick Navigation</h2>
        <ul className="toc-list">
          <li className="toc-item"><a href="#information-collect" className="toc-link">1. Information We Collect</a></li>
          <li className="toc-item"><a href="#how-we-use" className="toc-link">2. How We Use Your Information</a></li>
          <li className="toc-item"><a href="#third-party" className="toc-link">3. Third-Party Services</a></li>
          <li className="toc-item"><a href="#content-sensitivity" className="toc-link">4. Content Sensitivity</a></li>
          <li className="toc-item"><a href="#data-security" className="toc-link">5. Data Security</a></li>
          <li className="toc-item"><a href="#your-choices" className="toc-link">6. Your Choices</a></li>
          <li className="toc-item"><a href="#international-users" className="toc-link">7. International Users</a></li>
          <li className="toc-item"><a href="#changes" className="toc-link">8. Changes to This Policy</a></li>
          <li className="toc-item"><a href="#contact-us" className="toc-link">9. Contact Us</a></li>
        </ul>
      </div>

      <div className="privacy-section" id="information-collect">
        <h2 className="section-title"><span className="section-number">1</span> Information We Collect</h2>
        <div className="section-content">
          <p>We keep things simple. Since NutinButHeat.com is a content viewing platform with <strong>no user accounts or uploads</strong>, the personal data we collect is minimal.</p>
          <div className="data-grid">
            <div className="data-item"><h3 className="data-item-title"><span className="data-item-icon">📊</span> Usage Data</h3><ul><li>Pages visited</li><li>Time spent on site</li><li>Interaction with features (likes, shares, etc.)</li><li>Referring websites</li></ul></div>
            <div className="data-item"><h3 className="data-item-title"><span className="data-item-icon">🍪</span> Cookies &amp; Tracking</h3><ul><li>Performance cookies</li><li>Analytics cookies</li><li>Personalization cookies</li><li>Third-party tracking pixels</li></ul></div>
          </div>
          <p>We use cookies and similar tools to enhance performance, personalize content, and understand how users engage with the site. You can manage cookie preferences through your browser settings.</p>
        </div>
      </div>

      <div className="privacy-section" id="how-we-use">
        <h2 className="section-title"><span className="section-number">2</span> How We Use Your Information</h2>
        <div className="section-content">
          <p>We use the data we collect to:</p>
          <ul className="terms-list" style={{ margin: '20px 0', paddingLeft: 0, listStyle: 'none' }}>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#4caf50', fontWeight: 700 }}>•</span>Improve site performance and user experience</li>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#4caf50', fontWeight: 700 }}>•</span>Monitor trends and usage patterns</li>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#4caf50', fontWeight: 700 }}>•</span>Deliver relevant content and features</li>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#4caf50', fontWeight: 700 }}>•</span>Maintain site security</li>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#4caf50', fontWeight: 700 }}>•</span>Analyze engagement (likes, shares, traffic)</li>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#4caf50', fontWeight: 700 }}>•</span>Serve contextually relevant (and possibly third-party) ads</li>
          </ul>
          <div className="no-sale-promise"><span className="promise-icon">🚫</span><p className="promise-text">We do NOT sell your personal information.</p><p className="promise-subtext">Your privacy is not for sale. Ever.</p></div>
        </div>
      </div>

      <div className="privacy-section" id="third-party">
        <h2 className="section-title"><span className="section-number">3</span> Third-Party Services</h2>
        <div className="section-content">
          <p>NutinButHeat.com may use third-party services (such as analytics tools or ad networks) that collect data in accordance with their own privacy policies.</p>
          <div className="services-grid">
            <div className="service-item"><div className="service-name">Google Analytics</div><div className="service-type">Analytics Tool</div></div>
            <div className="service-item"><div className="service-name">Advertising Networks</div><div className="service-type">Ad Services</div></div>
            <div className="service-item"><div className="service-name">Twitter</div><div className="service-type">Social Sharing</div></div>
            <div className="service-item"><div className="service-name">Reddit</div><div className="service-type">Social Sharing</div></div>
          </div>
          <p style={{ marginTop: 20 }}><strong>Please note:</strong> Third-party content or embedded media may track your activity independently. We encourage you to review their policies.</p>
        </div>
      </div>

      <div className="privacy-section" id="content-sensitivity">
        <h2 className="section-title"><span className="section-number">4</span> Content Sensitivity</h2>
        <div className="section-content">
          <div className="age-warning"><p className="age-text">⚠️ NutinButHeat.com may include content that is <span className="highlight-text">intended for mature audiences</span>.</p></div>
          <p>While we do not ask for age verification, by using the site, you acknowledge that you are <strong className="highlight-text">18+ or of legal age in your jurisdiction</strong>.</p>
          <p>We do <strong>not</strong> knowingly collect data from minors.</p>
        </div>
      </div>

      <div className="privacy-section" id="data-security">
        <h2 className="section-title"><span className="section-number">5</span> Data Security</h2>
        <div className="section-content">
          <p>We take reasonable measures to protect your data from unauthorized access, misuse, or loss. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.</p>
          <div style={{ background: 'rgba(255,193,7,.1)', borderLeft: '4px solid #ffc107', padding: 16, borderRadius: 8, margin: '20px 0' }}><p style={{ color: '#fff', margin: 0, fontWeight: 500 }}>🔐 We implement industry-standard security measures, but remember: no system is 100% secure. Use the internet wisely.</p></div>
        </div>
      </div>

      <div className="privacy-section" id="your-choices">
        <h2 className="section-title"><span className="section-number">6</span> Your Choices</h2>
        <div className="section-content">
          <p>You have control over your privacy. Here's what you can do:</p>
          <ul style={{ margin: '20px 0', paddingLeft: 0, listStyle: 'none' }}>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#ff6b35', fontWeight: 700 }}>⚙️</span>You can disable cookies through your browser settings</li>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#ff6b35', fontWeight: 700 }}>🛡️</span>You may limit data collection by using privacy-focused browser tools or ad blockers</li>
            <li style={{ background: '#0f1419', border: '1px solid #2a3441', borderRadius: 8, padding: '12px 16px 12px 40px', marginBottom: 8, position: 'relative' }}><span style={{ position: 'absolute', left: 16, color: '#ff6b35', fontWeight: 700 }}>📧</span>You can contact us at any time to inquire about data practices or request data deletion (where applicable)</li>
          </ul>
        </div>
      </div>

      <div className="privacy-section" id="international-users">
        <h2 className="section-title"><span className="section-number">7</span> International Users</h2>
        <div className="section-content">
          <p>If you're accessing NutinButHeat.com from outside the United States, be aware that your information may be transferred to and stored on servers located in jurisdictions with different data protection laws.</p>
          <div style={{ background: 'rgba(54,162,235,.1)', borderLeft: '4px solid #36a2eb', padding: 16, borderRadius: 8, margin: '20px 0' }}><p style={{ color: '#fff', margin: 0, fontWeight: 500 }}>🌍 We respect international privacy regulations and work to comply with applicable data protection standards.</p></div>
        </div>
      </div>

      <div className="privacy-section" id="changes">
        <h2 className="section-title"><span className="section-number">8</span> Changes to This Policy</h2>
        <div className="section-content">
          <p>We may update this Privacy Policy from time to time. Any changes will be reflected here, with an updated effective date.</p>
          <p><strong>Your continued use of NutinButHeat.com signifies acceptance of the revised policy.</strong></p>
          <div style={{ background: 'rgba(255,107,53,.05)', border: '1px solid #ff6b35', borderRadius: 8, padding: 16, margin: '20px 0', textAlign: 'center' as const }}><p style={{ color: '#ff6b35', margin: 0, fontWeight: 600 }}>💡 We recommend bookmarking this page to stay updated on any changes.</p></div>
        </div>
      </div>

      <div className="privacy-section" id="contact-us">
        <h2 className="section-title"><span className="section-number">9</span> Contact Us</h2>
        <div className="section-content">
          <div className="contact-section">
            <h3 className="contact-title">Have questions or concerns about privacy?</h3>
            <a href="mailto:privacy@NutinButHeat.com" className="contact-email">📧 privacy@NutinButHeat.com</a>
          </div>
        </div>
      </div>

      <div className="footer-message"><strong>NutinButHeat.com — We keep it hot, not invasive. 🔥</strong></div>
    </div>
  </div>
}


