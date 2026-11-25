import { useEffect, useState } from 'react'
import '../AdminPortal.css'
import { getAdminToken } from './auth'
import { fmtNumber, timeAgo } from '../lib/format'

const PER = 20

type Report = { id: string; post_id: string | null; post_slug: string; post_title: string; reason: string; created_at: string }
type ContactMsg = { id: string; name: string; email: string; reason: string; message: string; ip_address: string; created_at: string }

async function adminGet(path: string, onAuthError: () => void) {
  const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}${path}`, { headers: { 'X-Admin-Token': getAdminToken() } })
  if (!r.ok) { if (r.status === 401) { onAuthError(); return null } throw new Error(`HTTP ${r.status}`) }
  return r.json()
}

function Pager({ page, pages, setPage }: { page: number; pages: number; setPage: (p: number) => void }) {
  return <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button></div>
}

export function ReportsInbox({ onAuthError }: { onAuthError: () => void }) {
  const [reports, setReports] = useState<Report[]>([]); const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const pages = Math.max(1, Math.ceil(total / PER))
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    ;(async () => {
      try {
        const d = await adminGet(`/admin/reports?page=${page}&per=${PER}`, onAuthError)
        if (cancelled || !d) return
        setReports(d.reports ?? []); setTotal(d.total ?? 0)
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load reports.') } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [page])
  return <div className="page-content">
    <div className="page-heading">Reports</div>
    <div className="page-sub">{fmtNumber(total)} reports · newest first · read-only</div>
    {error && <div className="empty-state">{error}</div>}
    {loading ? <div className="table-card"><div className="empty-state">Loading reports…</div></div>
      : reports.length === 0 ? <div className="table-card"><div className="empty-state">No reports yet.</div></div>
        : <div className="table-card"><table><thead><tr><th>Post</th><th>Reason</th><th>Reported</th></tr></thead><tbody>{reports.map(r => (
          <tr key={r.id}><td className="td-title">{r.post_slug ? <a href={`/${r.post_slug}`} target="_blank" rel="noopener noreferrer">{r.post_title || r.post_slug}</a> : <span>{r.post_title || '(deleted post)'}</span>}</td><td className="td-title" style={{ whiteSpace: 'pre-wrap' }}>{r.reason}</td><td className="td-time">{timeAgo(r.created_at)}</td></tr>
        ))}</tbody></table></div>}
    <Pager page={page} pages={pages} setPage={setPage} />
  </div>
}

export function ContactInbox({ onAuthError }: { onAuthError: () => void }) {
  const [messages, setMessages] = useState<ContactMsg[]>([]); const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const pages = Math.max(1, Math.ceil(total / PER))
  async function load(p: number) {
    setLoading(true); setError(''); setNotice('')
    try {
      const d = await adminGet(`/admin/contact?page=${p}&per=${PER}`, onAuthError)
      if (!d) return
      setMessages(d.messages ?? []); setTotal(d.total ?? 0)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load messages.') } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(() => { void load(page) }, 0); return () => clearTimeout(t) }, [page])
  const del = async (id: string) => {
    if (!window.confirm('Delete this message?')) return
    setError('')
    try {
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/contact/${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() } })
      if (!r.ok) { if (r.status === 401) { onAuthError(); return } throw new Error(`HTTP ${r.status}`) }
      setNotice('Message deleted.')
      if (messages.length === 1 && page > 1) setPage(page - 1); else load(page)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete.') }
  }
  return <div className="page-content">
    <div className="page-heading">Contact</div>
    <div className="page-sub">{fmtNumber(total)} messages · newest first</div>
    {notice && <div className="manage-notice">{notice}</div>}
    {error && <div className="empty-state">{error}</div>}
    {loading ? <div className="table-card"><div className="empty-state">Loading messages…</div></div>
      : messages.length === 0 ? <div className="table-card"><div className="empty-state">No messages yet.</div></div>
        : <div className="table-card"><table><thead><tr><th>From</th><th>Reason</th><th>Message</th><th>Received</th><th></th></tr></thead><tbody>{messages.map(m => (
          <tr key={m.id}><td className="td-title"><span>{m.name}<small>{m.email}</small></span></td><td className="td-category">{m.reason}</td><td className="td-title" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</td><td className="td-time">{timeAgo(m.created_at)}</td><td className="td-actions"><button className="delete-btn" onClick={() => del(m.id)}>Delete</button></td></tr>
        ))}</tbody></table></div>}
    <Pager page={page} pages={pages} setPage={setPage} />
  </div>
}
