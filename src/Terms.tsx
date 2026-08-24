import { useEffect, useState } from 'react'
import './Terms.css'
import { linkTo, navigate } from './lib/router'

export default function Terms() {
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.terms-page .terms-section, .terms-page .toc-section')
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; el.style.transition = 'opacity 0.6s ease, transform 0.6s ease' })
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.transform = 'translateY(0)' } }) }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('.terms-section')
    const links = document.querySelectorAll<HTMLAnchorElement>('.toc-link')
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { const id = e.target.getAttribute('id'); links.forEach(l => { l.style.color = l.getAttribute('href') === `#${id}` ? '#ff6b35' : '' }) } }) }, { threshold: 0.7, rootMargin: '-80px 0px -50% 0px' })
    sections.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`) }

  return <div className="terms-page">
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

    <div className="tos-container">
      <div className="hero-section">
        <span className="legal-icon">⚖️</span>
        <h1 className="main-title">Terms of Service</h1>
        <p className="effective-date"><strong>Effective Date:</strong> December 15, 2024</p>
        <div className="intro-text">
          Welcome to <strong className="highlight-text">NutinButHeat.com</strong> ("NutinButHeat", "we", "us", or "our").
          By accessing or using our website, you agree to these Terms of Service ("Terms"). Please read them carefully.<br /><br />
          <strong>If you do not agree to these Terms, you may not use NutinButHeat.com.</strong>
        </div>
      </div>

      <div className="toc-section">
        <h2 className="toc-title">📋 Quick Navigation</h2>
        <ul className="toc-list">
          <li className="toc-item"><a href="#eligibility" className="toc-link">1. Eligibility</a></li>
          <li className="toc-item"><a href="#content-notice" className="toc-link">2. Content Notice</a></li>
          <li className="toc-item"><a href="#use-of-site" className="toc-link">3. Use of the Site</a></li>
          <li className="toc-item"><a href="#intellectual-property" className="toc-link">4. Intellectual Property</a></li>
          <li className="toc-item"><a href="#third-party" className="toc-link">5. Third-Party Content</a></li>
          <li className="toc-item"><a href="#privacy" className="toc-link">6. Privacy</a></li>
          <li className="toc-item"><a href="#warranties" className="toc-link">7. Disclaimer of Warranties</a></li>
          <li className="toc-item"><a href="#liability" className="toc-link">8. Limitation of Liability</a></li>
          <li className="toc-item"><a href="#termination" className="toc-link">9. Termination</a></li>
          <li className="toc-item"><a href="#changes" className="toc-link">10. Changes to Terms</a></li>
          <li className="toc-item"><a href="#contact-us" className="toc-link">11. Contact Us</a></li>
        </ul>
      </div>

      <div className="terms-section" id="eligibility">
        <h2 className="section-title"><span className="section-number">1</span> Eligibility</h2>
        <div className="section-content">
          <div className="age-requirement"><p className="age-text">You must be <span className="highlight-text">18 years or older</span> (or the age of majority in your jurisdiction) to use NutinButHeat.com.</p></div>
          <p>By accessing the site, you confirm that you meet this requirement and have the legal capacity to enter into these Terms.</p>
        </div>
      </div>

      <div className="terms-section" id="content-notice">
        <h2 className="section-title"><span className="section-number">2</span> Content Notice</h2>
        <div className="section-content">
          <div className="warning-notice"><span className="warning-icon">⚠️</span><p className="warning-text">NutinButHeat.com curates content from around the internet, and some of it may be considered mature, suggestive, or not suitable for all audiences. Viewer discretion is advised.</p></div>
          <p>We do not host user-uploaded content. All materials are curated by our team or embedded/linked in compliance with applicable guidelines.</p>
        </div>
      </div>

      <div className="terms-section" id="use-of-site">
        <h2 className="section-title"><span className="section-number">3</span> Use of the Site</h2>
        <div className="section-content">
          <p>You agree to use NutinButHeat.com for lawful purposes only.</p>
          <h3 style={{ color: '#4caf50', margin: '24px 0 16px', fontSize: 18 }}>✓ You may:</h3>
          <ul className="terms-list"><li>View, like, and share content within the functionality provided</li><li>Bookmark or save content for personal use</li><li>Engage respectfully with the site and its features</li></ul>
          <h3 style={{ color: '#e53e3e', margin: '24px 0 16px', fontSize: 18 }}>✗ You may NOT:</h3>
          <ul className="terms-list prohibited-list"><li>Use the site in any way that violates laws or regulations</li><li>Attempt to access, scrape, or alter the site's code or backend</li><li>Bypass access restrictions or attempt to upload content (where not permitted)</li><li>Impersonate, misrepresent, or misuse the platform</li></ul>
        </div>
      </div>

      <div className="terms-section" id="intellectual-property">
        <h2 className="section-title"><span className="section-number">4</span> Intellectual Property</h2>
        <div className="section-content">
          <p>All content displayed on NutinButHeat.com is the property of its respective owners. <strong>NutinButHeat does not claim ownership of third-party content</strong> and complies with DMCA and other takedown processes when needed.</p>
          <p>You may not reproduce, modify, or distribute any part of the site or its content without permission, except through provided sharing tools.</p>
        </div>
      </div>

      <div className="terms-section" id="third-party">
        <h2 className="section-title"><span className="section-number">5</span> Third-Party Content &amp; Links</h2>
        <div className="section-content">
          <p>NutinButHeat.com may include content, links, or embeds from third-party websites. We are not responsible for the accuracy, policies, or practices of those third parties.</p>
          <p><strong>Your use of third-party content is at your own risk.</strong></p>
        </div>
      </div>

      <div className="terms-section" id="privacy">
        <h2 className="section-title"><span className="section-number">6</span> Privacy</h2>
        <div className="section-content"><p>We respect your privacy. Please review our <strong className="highlight-text">Privacy Policy</strong> to understand how we collect, use, and protect your data.</p></div>
      </div>

      <div className="terms-section" id="warranties">
        <h2 className="section-title"><span className="section-number">7</span> Disclaimer of Warranties</h2>
        <div className="section-content"><p>NutinButHeat.com is provided <strong>"as is"</strong> and <strong>"as available."</strong> We do not guarantee the accuracy, completeness, or reliability of any content on the site.</p><p><strong className="highlight-text">Use the site at your own risk.</strong></p></div>
      </div>

      <div className="terms-section" id="liability">
        <h2 className="section-title"><span className="section-number">8</span> Limitation of Liability</h2>
        <div className="section-content"><p>To the maximum extent permitted by law, NutinButHeat.com and its affiliates are not liable for any indirect, incidental, or consequential damages resulting from your use of the site.</p></div>
      </div>

      <div className="terms-section" id="termination">
        <h2 className="section-title"><span className="section-number">9</span> Termination</h2>
        <div className="section-content"><p>We reserve the right to restrict or terminate access to the site, without notice, for conduct that violates these Terms or is harmful to other users or NutinButHeat.com.</p></div>
      </div>

      <div className="terms-section" id="changes">
        <h2 className="section-title"><span className="section-number">10</span> Changes to Terms</h2>
        <div className="section-content"><p>We may update these Terms from time to time. Any changes will be posted here with an updated effective date.</p><p><strong>Continued use of the site means you accept the updated Terms.</strong></p></div>
      </div>

      <div className="terms-section" id="contact-us">
        <h2 className="section-title"><span className="section-number">11</span> Contact Us</h2>
        <div className="section-content">
          <div className="contact-section">
            <h3 className="contact-title">Have questions or concerns?</h3>
            <a href="mailto:support@NutinButHeat.com" className="contact-email">📧 support@NutinButHeat.com</a>
          </div>
        </div>
      </div>

      <div className="footer-message"><strong>Thank you for using NutinButHeat. Scroll responsibly. 🔥</strong></div>
    </div>
  </div>
}


