import { useEffect, useState } from 'react'
import './Contact.css'
import { linkTo, navigate } from './lib/router'

const apiUrl = import.meta.env.VITE_APPWRITE_API_URL

export default function Contact() {
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState('')
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [reason, setReason] = useState(''); const [message, setMessage] = useState(''); const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false); const [success, setSuccess] = useState(''); const [error, setError] = useState('')

  useEffect(() => {
    // turnstile script
    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; s.async = true; s.defer = true; document.head.appendChild(s)
    }
    const els = document.querySelectorAll<HTMLElement>('.contact-page .email-card, .contact-page .contact-form-container, .contact-page .response-time')
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(20px)'; el.style.transition = 'opacity 0.6s ease, transform 0.6s ease' })
    const obs = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.transform = 'translateY(0)' } }) }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' })
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      const a = document.querySelector<HTMLElement>('.contact-page .email-card'); if (a) { a.style.opacity = '1'; a.style.transform = 'translateY(0)' }
    }, 100)
    const t2 = setTimeout(() => {
      const b = document.querySelector<HTMLElement>('.contact-page .contact-form-container'); if (b) { b.style.opacity = '1'; b.style.transform = 'translateY(0)' }
    }, 200)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [])

  const submitSearch = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`) }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSuccess(''); setError('')
    const tokenInput = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
    const token = tokenInput?.value?.trim() ?? ''
    if (!token) { setError('Please complete the CAPTCHA.'); return }
    if (!name.trim() || !email.trim() || !reason || !message.trim()) { setError('Please fill in all fields.'); return }
    setSending(true)
    try {
      const r = await fetch(`${apiUrl}/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), reason, message: message.trim(), website: website.trim(), 'cf-turnstile-response': token }) })
      const j = await r.json().catch(() => null) as { error?: string; ok?: boolean } | null
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`)
      setSuccess('Message sent successfully!'); setName(''); setEmail(''); setReason(''); setMessage(''); setWebsite('')
      // reset turnstile
      const w = window as unknown as { turnstile?: { reset: () => void } }
      w.turnstile?.reset()
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.') } finally { setSending(false) }
  }

  return <div className="contact-page">
    <header className="header">
      <div className="header-container">
        <div className="left-section">
          <button className={`hamburger ${menu ? 'active' : ''}`} onClick={() => setMenu(!menu)} aria-label="Toggle navigation"><span /><span /><span /></button>
          <a href="/" onClick={linkTo('/')} className="logo-link"><img src="/logo3.png" alt="NutinButHeat" className="logo-img" /></a>
        </div>
        <div className="search-container">
          <form onSubmit={submitSearch} className="gf">
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

    <div className="contact-container">
      <div className="hero-section">
        <span className="contact-icon">📞</span>
        <h1 className="main-title">Get in Touch</h1>
        <p className="subtitle">We're here to help, listen, and keep the 🔥 burning</p>
        <p className="intro-text">Got questions, feedback, or just want to share something awesome? We'd love to hear from you. Our team is passionate about great content and even better conversations.</p>
      </div>

      <div className="contact-methods">
        <div className="email-card">
          <span className="email-icon">📧</span>
          <h3 className="email-title">Email Us</h3>
          <p className="email-description">Questions, feedback, partnerships, support, or just want to say hi? Drop us a line and we'll get back to you soon.</p>
          <a href="mailto:hello@NutinButHeat.com" className="email-button" onClick={e => { e.preventDefault(); navigator.clipboard.writeText('hello@NutinButHeat.com').then(() => { const b = e.currentTarget; const t = b.innerHTML; b.innerHTML = '✅ Email Copied!'; setTimeout(() => b.innerHTML = t, 2000) }) }}>📧 hello@NutinButHeat.com</a>
        </div>

        <div className="contact-form-container">
          <h3 className="form-title">Send us a Message</h3>
          {success && <div className="success">{success}</div>}
          {error && <div className="error">{error}</div>}
          <form className="contact-form" onSubmit={onSubmit}>
            <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <input type="text" name="website" style={{ display: 'none' }} value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
            <div className="form-group"><label className="form-label">Reason *</label>
              <select className="form-select" value={reason} onChange={e => setReason(e.target.value)} required>
                <option value="">Select a reason...</option>
                <option value="general">General Inquiry</option>
                <option value="feedback">Feedback</option>
                <option value="support">Technical Support</option>
                <option value="content">Content Suggestion</option>
                <option value="report">Report Content</option>
                <option value="business">Business/Partnership</option>
                <option value="privacy">Privacy/Data</option>
                <option value="legal">Legal/DMCA</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Message *</label><textarea className="form-textarea" placeholder="Tell us what's on your mind..." value={message} onChange={e => setMessage(e.target.value)} required /></div>
            <div className="cf-turnstile" data-sitekey="0x4AAAAAADJDZeIbw_gkI4mi"></div>
            <button type="submit" className="submit-button" disabled={sending}>{sending ? 'Sending…' : '🚀 Send Message'}</button>
          </form>
        </div>
      </div>

      <div className="response-time">
        <span className="response-icon">⚡</span>
        <h3 className="response-title">Response Time</h3>
        <p className="response-text">We typically respond within <span className="highlight-text">24-48 hours</span> during business days. For urgent issues, we'll get back to you even faster!</p>
      </div>

      <div className="footer-message">
        <p className="footer-message-text">Thanks for being part of the NutinButHeat community!</p>
        <p className="footer-subtext">We're always here to help keep your content experience 🔥</p>
      </div>
    </div>
  </div>
}


