import { useEffect, useState } from 'react'
import '../AdminPortal.css'
import { getAdminToken } from './auth'
import { fmtNumber, timeAgo } from '../lib/format'

const PER = 20

type PasteRow = { id: string; slug: string; title: string; views: number; created_at: string; url: string }

export default function PasteManager({ onAuthError }: { onAuthError: () => void }) {
  const [title, setTitle] = useState(''); const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false); const [formError, setFormError] = useState(''); const [newUrl, setNewUrl] = useState('')
  const [pastes, setPastes] = useState<PasteRow[]>([]); const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const pages = Math.max(1, Math.ceil(total / PER))

  async function load(p: number) {
    setLoading(true); setError('')
    try {
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/pastes?page=${p}&per=${PER}`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (!r.ok) { if (r.status === 401) { onAuthError(); return } throw new Error(`HTTP ${r.status}`) }
      const d = await r.json() as { total: number; pastes: PasteRow[] }
      setTotal(d.total); setPastes(d.pastes ?? [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load pastes.') } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(() => { void load(page) }, 0); return () => clearTimeout(t) }, [page])

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); if (saving || !content.trim()) return
    setSaving(true); setFormError(''); setNewUrl('')
    try {
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/pastes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() }, body: JSON.stringify({ title: title.trim(), content: content.trim() }) })
      const d = await r.json().catch(() => null) as { url?: string; error?: string } | null
      if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`)
      setNewUrl(d?.url ?? ''); setTitle(''); setContent('')
      if (page === 1) load(1); else setPage(1)
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Could not create paste.') } finally { setSaving(false) }
  }

  const copyLink = (row: PasteRow) => {
    navigator.clipboard.writeText(row.url).catch(() => {})
    setCopiedSlug(row.slug); setTimeout(() => setCopiedSlug(c => c === row.slug ? null : c), 1400)
  }

  const del = async (row: PasteRow) => {
    if (!window.confirm(`Delete paste “${row.title || row.slug}”?`)) return
    setError('')
    try {
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/pastes/${row.id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() } })
      if (!r.ok) { if (r.status === 401) { onAuthError(); return } throw new Error(`HTTP ${r.status}`) }
      if (pastes.length === 1 && page > 1) setPage(page - 1); else load(page)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete.') }
  }

  return <div className="page-content">
    <div className="page-heading">Text Pastes</div>
    <div className="page-sub">Admin-only publishing · 3-character URLs · views hidden from visitors</div>
    <div className="admin admin-form">
      <form onSubmit={create}>
        <label>Title (optional)<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled" maxLength={200} /></label>
        <label>Paste content<textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Paste text or links here..." rows={8} required maxLength={20000} style={{ width: '100%' }} /></label>
        {formError && <output>{formError}</output>}
        {newUrl && <output>Created: <a href={newUrl.replace(window.location.origin, '')} target="_blank" rel="noopener noreferrer">{newUrl}</a></output>}
        <button disabled={saving || !content.trim()}>{saving ? 'Creating…' : 'Create paste'}</button>
      </form>
    </div>
    {error && <div className="empty-state">{error}</div>}
    {loading ? <div className="table-card"><div className="empty-state">Loading pastes…</div></div>
      : pastes.length === 0 ? <div className="table-card"><div className="empty-state">No pastes yet.</div></div>
        : <div className="table-card"><table><thead><tr><th>Paste</th><th>Views</th><th>Added</th><th>Actions</th></tr></thead><tbody>{pastes.map(p => (
          <tr key={p.id}><td className="td-title"><a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer">{p.title || p.slug}</a><small>/{p.slug}</small></td><td className="td-views">👁 {fmtNumber(p.views)}</td><td className="td-time">{timeAgo(p.created_at)}</td><td className="td-actions"><button className="edit-btn" onClick={() => copyLink(p)}>{copiedSlug === p.slug ? 'Copied ✓' : 'Copy link'}</button><button className="delete-btn" onClick={() => del(p)}>Delete</button></td></tr>
        ))}</tbody></table></div>}
    <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button></div>
  </div>
}
