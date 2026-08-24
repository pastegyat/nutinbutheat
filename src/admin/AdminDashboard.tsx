import { useEffect, useRef, useState, type ReactNode } from 'react'
import Chart from 'chart.js/auto'
import '../AdminPortal.css'
import '../AdminDashboard.css'
import AdminGate from './AdminGate'
import { getAdminToken, clearAdminToken } from './auth'
import PostForm from './PostForm'
import ManagePosts from './ManagePosts'
import AddAlbum from './AddAlbum'
import ManageAlbums from './ManageAlbums'
import { getAdminStats, type AdminStats } from '../lib/appwrite'
import { fmtNumber, timeAgo } from '../lib/format'

const avgTime = (ms: number | null) => { if (ms === null || ms === undefined) return '–'; const s = Math.round(ms / 1000); if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`; return `${s}s` }

type View = 'dashboard' | 'add' | 'manage' | 'add-album' | 'manage-albums' | { kind: 'soon'; label: string; desc: string }

const soon = (label: string, desc: string): View => ({ kind: 'soon', label, desc })
const NavItem = ({ icon, label, badge, active, onClick }: { icon: ReactNode; label: string; badge?: string; active?: boolean; onClick: () => void }) => (
  <a className={`nav-item${active ? ' active' : ''}`} onClick={onClick}>{icon}{label}{badge && <span className="badge">{badge}</span>}</a>
)
const iconGrid = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
const iconPlus = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
const iconDoc = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
const iconVideo = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
const iconEye = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
const iconUser = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M6 20c0-4 3-6 6-6s6 2 6 6" /></svg>
const iconReport = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="16" x2="8" y2="12" /><line x1="12" y1="16" x2="12" y2="10" /><line x1="16" y1="16" x2="16" y2="14" /></svg>
const iconHome = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
const iconLogout = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>

const StatCard = ({ icon, tone, value, label }: { icon: ReactNode; tone: string; value: string; label: string }) => (
  <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div></div>
)

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('nbh_admin_token'))
  const [notice, setNotice] = useState('')
  const [view, setView] = useState<View>('dashboard')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const chartRef = useRef<HTMLCanvasElement>(null); const chartInstance = useRef<Chart | null>(null)

  const handleAuthError = () => { clearAdminToken(); setAuthed(false); setNotice('Session expired. Please sign in again.') }
  const logout = () => { clearAdminToken(); setAuthed(false); setNotice(''); setStats(null); setLoadError(''); setView('dashboard') }

  useEffect(() => {
    if (!authed || view !== 'dashboard') return
    let cancelled = false
    ;(async () => { const { status, data } = await getAdminStats(getAdminToken()); if (cancelled) return; if (status === 401) { handleAuthError(); return } if (data) { setStats(data); setLoadError('') } else { setLoadError('Could not load stats. Check the Worker and try again.') } })()
    return () => { cancelled = true }
  }, [authed, view, reload])

  useEffect(() => {
    if (!chartRef.current || !stats?.traffic.length) return
    const canvas = chartRef.current; const ctx = canvas.getContext('2d'); if (!ctx) return
    chartInstance.current?.destroy()
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: { labels: stats.traffic.map(t => t.day.slice(5)), datasets: [{ label: 'Views', data: stats.traffic.map(t => t.views), borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.08)', borderWidth: 2, pointBackgroundColor: '#ff6b35', pointRadius: 4, pointHoverRadius: 6, fill: true, tension: 0.4 }] },
      options: { responsive: true, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1f2e', borderColor: '#2a3441', borderWidth: 1, titleColor: '#fff', bodyColor: '#b8c5d6' } }, scales: { x: { grid: { color: '#2a3441' }, ticks: { color: '#6b7684', font: { size: 11 } } }, y: { grid: { color: '#2a3441' }, ticks: { color: '#6b7684', font: { size: 11 } }, beginAtZero: true } } }
    })
    return () => { chartInstance.current?.destroy(); chartInstance.current = null }
  }, [stats])

  if (!authed) return <AdminGate notice={notice} onLogin={() => { setAuthed(true); setNotice(''); setStats(null); setLoadError('') }} />

  const t = stats?.totals
  return <div className="dash">
    <div className={`sidebar-overlay${menuOpen ? ' active' : ''}`} onClick={() => setMenuOpen(false)} />
    <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
      <div className="sidebar-logo"><span className="brand-text">NUTIN<span>BUT</span>HEAT</span><span className="brand-sub">Admin Panel</span></div>
      <div className="sidebar-section"><div className="sidebar-section-label">Overview</div><NavItem icon={iconGrid} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} /></div>
      <div className="sidebar-section"><div className="sidebar-section-label">Posts</div><NavItem icon={iconPlus} label="Add Post" active={view === 'add'} onClick={() => setView('add')} /><NavItem icon={iconDoc} label="Manage Posts" active={view === 'manage'} badge={fmtNumber(t?.posts)} onClick={() => setView('manage')} /></div>
      <div className="sidebar-section"><div className="sidebar-section-label">Videos</div><NavItem icon={iconPlus} label="Upload Video" onClick={() => setView(soon('Upload Video', 'Video uploads are coming soon.'))} /><NavItem icon={iconVideo} label="Manage Videos" onClick={() => setView(soon('Manage Videos', 'Video management is coming soon.'))} /></div>
      <div className="sidebar-section"><div className="sidebar-section-label">Albums</div><NavItem icon={iconPlus} label="Add Album" active={view === 'add-album'} onClick={() => setView('add-album')} /><NavItem icon={iconDoc} label="Manage albums" active={view === 'manage-albums'} onClick={() => setView('manage-albums')} /><NavItem icon={iconEye} label="Album Views" onClick={() => setView(soon('Album Views', 'Album analytics are coming soon.'))} /></div>
      <div className="sidebar-section"><NavItem icon={iconUser} label="Contact" onClick={() => setView(soon('Contact', 'Contact submissions are coming soon.'))} /><NavItem icon={iconReport} label="Reports" onClick={() => setView(soon('Reports', 'Reported content is coming soon.'))} /></div>
      <div className="sidebar-footer"><NavItem icon={iconHome} label="View Site" onClick={() => window.open(window.location.origin, '_blank')} /><a className="logout-btn" onClick={logout}>{iconLogout}Log Out</a></div>
    </aside>

    <div className="main">
      <div className="topbar">
        <div className="topbar-left"><button className="hamburger-btn" onClick={() => setMenuOpen(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg></button><span className="topbar-title">{view === 'dashboard' ? 'Dashboard' : view === 'add' ? 'Add Post' : view === 'manage' ? 'Manage Posts' : view === 'add-album' ? 'Add Album' : view === 'manage-albums' ? 'Manage Albums' : (view as { label: string }).label}</span></div>
        <div className="topbar-right"><a className="view-site-btn" href="/" target="_blank" rel="noopener noreferrer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>View Site</a></div>
      </div>

      {view === 'add' ? <div className="page-content"><div className="page-heading">Publish a new drop</div><div className="page-sub">Create new content for the feed.</div><div className="admin admin-form"><PostForm onAuthError={handleAuthError} onSaved={() => { setStats(null); setLoadError(''); setReload(r => r + 1) }} /></div></div>
        : view === 'add-album' ? <div className="page-content"><div className="page-heading">Create Album</div><div className="page-sub">Albums appear at /albums and /a/{'{slug}'}.</div><div className="admin admin-form"><AddAlbum onAuthError={handleAuthError} onSaved={() => { setStats(null); setLoadError(''); setReload(r => r + 1) }} /></div></div>
        : view === 'manage' ? <ManagePosts onAuthError={handleAuthError} onChanged={() => { setStats(null); setLoadError(''); setReload(r => r + 1) }} />
        : view === 'manage-albums' ? <ManageAlbums onAuthError={handleAuthError} onChanged={() => { setStats(null); setLoadError(''); setReload(r => r + 1) }} />
          : view !== 'dashboard' ? <div className="page-content"><div className="page-heading">{view.label}</div><div className="page-sub">{view.desc}</div><div className="table-card"><div className="empty-state">This module isn't wired up yet.</div></div><button className="back-btn" onClick={() => setView('dashboard')}>← Back to Dashboard</button></div>
          : <div className="page-content">
              <div className="page-heading">Welcome back 👋</div>
              <div className="page-sub">Here's what's happening on NutinButHeat today.</div>
              {!stats && !loadError ? <div className="table-card"><div className="empty-state">Loading stats…</div></div>
                : loadError ? <div className="table-card"><div className="empty-state">{loadError}</div></div>
                  : stats && t && <>
                    <div className="stats-grid">
                      <StatCard icon={iconDoc} tone="orange" value={fmtNumber(t.posts)} label="Total Posts" />
                      <StatCard icon={iconVideo} tone="blue" value="–" label="Total Videos" />
                      <StatCard icon={iconVideo} tone="gold" value="–" label="Premium Videos" />
                      <StatCard icon={iconEye} tone="green" value={fmtNumber(t.publicCount)} label="Public Posts" />
                      <StatCard icon={iconDoc} tone="gray" value={fmtNumber(t.privateCount)} label="Private Posts" />
                      <StatCard icon={iconEye} tone="purple" value={fmtNumber(t.postViews)} label="Total Post Views" />
                      <StatCard icon={iconVideo} tone="purple" value="–" label="Total Video Views" />
                      <StatCard icon={iconGrid} tone="pink" value="–" label="Total Album Views" />
                      <StatCard icon={iconReport} tone="blue" value={fmtNumber(stats.todayViews)} label="Pageviews Today" />
                      <StatCard icon={iconGrid} tone="green" value="–" label="Avg. Session Duration" />
                    </div>
                    <div className="section-title">Quick Actions</div>
                    <div className="actions-grid">
                      <a className="action-card" onClick={() => setView('add')}><div className="action-icon orange">📝</div><div className="action-label">Add Post</div><div className="action-sub">Create new content</div></a>
                      <a className="action-card" onClick={() => setView(soon('Upload Video', 'Video uploads are coming soon.'))}><div className="action-icon blue">🎬</div><div className="action-label">Upload Video</div><div className="action-sub">Add single or bulk</div></a>
                      <a className="action-card" onClick={() => setView('manage')}><div className="action-icon purple">📋</div><div className="action-label">Manage Posts</div><div className="action-sub">{fmtNumber(t.posts)} posts total</div></a>
                      <a className="action-card" onClick={() => setView(soon('Manage Videos', 'Video management is coming soon.'))}><div className="action-icon gold">🎥</div><div className="action-label">Manage Videos</div><div className="action-sub">– videos total</div></a>
                    </div>
                    <div className="two-col">
                      <div className="table-card"><div className="table-card-header"><span className="table-card-title">Recent Posts</span></div>{stats.recentPosts.length ? <table><thead><tr><th>Title</th><th>Views</th><th>Link Clicks</th><th>Added</th></tr></thead><tbody>{stats.recentPosts.map(p => <tr key={p.title}><td className="td-title">{p.title}</td><td className="td-views">🔥 {fmtNumber(p.views)}</td><td className="td-views">🔗 {fmtNumber(p.link_clicks)}</td><td className="td-time">{timeAgo(p.created_at)}</td></tr>)}</tbody></table> : <div className="empty-state">No posts yet</div>}</div>
                      <div className="table-card"><div className="table-card-header"><span className="table-card-title">Recent Videos</span></div><div className="empty-state">No videos yet</div></div>
                    </div>
                    <div className="table-card full" style={{ marginBottom: 32 }}><div className="table-card-header"><span className="table-card-title">Recent Albums</span></div><div className="empty-state">No albums yet</div></div>
                    <div className="section-title">Traffic — Last 14 Days</div>
                    <div className="table-card chart-card"><canvas ref={chartRef} height="90" /></div>
                    <div className="table-card"><div className="table-card-header"><span className="table-card-title">Most Clicked Posts</span><span className="table-card-note">All time</span></div>{stats.topClicked.length ? <table><thead><tr><th>Post</th><th>Link Clicks</th></tr></thead><tbody>{stats.topClicked.map(p => <tr key={p.slug}><td className="td-title"><a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer">{p.title}</a></td><td className="td-views">🔗 {fmtNumber(p.link_clicks)}</td></tr>)}</tbody></table> : <div className="empty-state">No link clicks yet</div>}</div>
                    <div className="two-col">
                      <div className="table-card"><div className="table-card-header"><span className="table-card-title">Top Pages</span><span className="table-card-note">Last 30 days</span></div>{stats.topPages.length ? <table><thead><tr><th>Page</th><th>Visits</th><th>Avg Time</th></tr></thead><tbody>{stats.topPages.map(item => <tr key={item.path}><td className="td-title">{item.path}</td><td className="td-views">{fmtNumber(item.visits)}</td><td className="td-time">{avgTime(item.avgDuration)}</td></tr>)}</tbody></table> : <div className="empty-state">No data yet</div>}</div>
                      <div className="table-card"><div className="table-card-header"><span className="table-card-title">Top Searches</span><span className="table-card-note">Last 30 days</span></div>{stats.topSearches.length ? <table><thead><tr><th>Search Term</th><th>Count</th></tr></thead><tbody>{stats.topSearches.map(item => <tr key={item.term}><td className="td-title">{item.term}</td><td className="td-views">{fmtNumber(item.count)}</td></tr>)}</tbody></table> : <div className="empty-state">No data yet</div>}</div>
                    </div>
                  </>}
            </div>}
    </div>
  </div>
}