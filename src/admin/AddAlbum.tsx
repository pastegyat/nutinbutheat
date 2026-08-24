import { useState, type FormEvent } from 'react'
import { getAdminToken } from './auth'

export default function AddAlbum({ onAuthError, onSaved }: { onAuthError: () => void; onSaved?: () => void }) {
  const [msg, setMsg] = useState(''); const [saving, setSaving] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; setSaving(true); setMsg('')
    try {
      const res = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/albums`, { method: 'POST', headers: { 'X-Admin-Token': getAdminToken() }, body: new FormData(form) })
      if (!res.ok) { if (res.status === 401) { onAuthError(); return }; const j = await res.json().catch(() => null); throw new Error(j?.error ?? `HTTP ${res.status}`) }
      const data = await res.json() as { slug?: string; title?: string }
      setMsg(`✅ Album "${data.title ?? 'created'}" — /a/${data.slug ?? ''}`); form.reset(); onSaved?.()
    } catch (err) { setMsg(`❌ ${err instanceof Error ? err.message : 'Failed'}`) } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="album-form">
    <label className="lbl">Album Title *<input name="title" required placeholder="e.g. Beach Day" /></label>
    <label className="lbl">Description<textarea name="description" placeholder="Optional description" rows={3} /></label>
    <label className="lbl">Album Cover URL (optional)<input name="album_thumbnail" placeholder="https://images.nutinbutheat.com/album-thumbs/..." /></label>
    <label className="lbl">Or upload cover image<input name="thumbnail_file" type="file" accept="image/*" /></label>
    <label className="check-wrap"><input type="checkbox" name="is_premium" value="1" /><span className="chk-box">★</span> Premium Album</label>
    {msg && <div className={msg.startsWith('✅') ? 'msg success' : 'msg error'}>{msg}</div>}
    <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Album'}</button>
  </form>
}
