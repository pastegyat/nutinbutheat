import { useEffect, useRef, useState } from 'react'
import { getAdminToken } from './auth'
import { fmtNumber } from '../lib/format'

type AlbumRow = { $id: string; title: string; slug: string; thumbnail: string; is_premium: string; view_count?: number; created_at: string; item_count?: number }

type ItemRow = { localId: number; type: 'video' | 'image'; title: string; r2_url: string; thumbnail: string; fileName: string; progress: number; status: string; hasFile: boolean }

const PER = 20
const ALLOWED_FOLDERS = { video: 'album-videos', image: 'album-images' } as const

async function presign(filename: string, type: string, folder: string) {
  const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/albums/presign`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() }, body: JSON.stringify({ filename, type, folder }) })
  if (!r.ok) throw new Error(`Presign failed ${r.status}`)
  return r.json() as Promise<{ uploadUrl: string; publicUrl: string; key: string }>
}

function xhrPut(url: string, file: Blob, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', (file as File).type || 'application/octet-stream')
    xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)) })
    xhr.addEventListener('load', () => xhr.status === 200 || xhr.status === 204 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)))
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.send(file)
  })
}

async function generateVideoThumb(file: File): Promise<Blob | null> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    video.preload = 'metadata'; video.muted = true; (video as unknown as Record<string, unknown>).playsInline = true
    const url = URL.createObjectURL(file)
    video.src = url
    video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(video.duration * 0.1, 5) })
    video.addEventListener('seeked', () => {
      canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(b => { URL.revokeObjectURL(url); resolve(b) }, 'image/jpeg', 0.85)
    })
    video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null) })
    video.load()
  })
}

export default function ManageAlbums({ onAuthError, onChanged }: { onAuthError: () => void; onChanged: () => void }) {
  const [albums, setAlbums] = useState<AlbumRow[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [err, setErr] = useState(''); const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(''); const [rows, setRows] = useState<ItemRow[]>([]); const [saving, setSaving] = useState(false); const [inFlight, setInFlight] = useState(0)
  const bulkInputRef = useRef<HTMLInputElement>(null); const [bulkInfo, setBulkInfo] = useState<{ active: boolean; done: number; total: number }>({ active: false, done: 0, total: 0 })
  const pages = Math.max(1, Math.ceil(total / PER))
  const nextId = useRef(0)

  async function load(p: number) {
    setLoading(true); setErr('')
    try {
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/albums?page=${p}&per=${PER}`, { headers: { 'X-Admin-Token': getAdminToken() } })
      if (!r.ok) { if (r.status === 401) { onAuthError(); return } throw new Error(`HTTP ${r.status}`) }
      const d = await r.json() as { total: number; albums: AlbumRow[] }; setTotal(d.total); setAlbums(d.albums)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(() => { void load(page) }, 0); return () => clearTimeout(t) }, [page])

  const updateRow = (id: number, patch: Partial<ItemRow>) => setRows(r => r.map(x => x.localId === id ? { ...x, ...patch } : x))

  async function uploadForRow(file: File, localId: number, type: 'video' | 'image') {
    setInFlight(v => v + 1)
    try {
      const folder = type === 'video' ? ALLOWED_FOLDERS.video : ALLOWED_FOLDERS.image
      updateRow(localId, { status: 'Uploading…', progress: 0, hasFile: true, fileName: file.name })
      const { uploadUrl, publicUrl } = await presign(file.name, file.type, folder)
      await xhrPut(uploadUrl, file, pct => updateRow(localId, { progress: pct }))
      updateRow(localId, { r2_url: publicUrl, progress: 100, status: '✅ Uploaded' })
      if (type === 'image') {
        updateRow(localId, { thumbnail: publicUrl })
      } else {
        const thumbBlob = await generateVideoThumb(file)
        if (thumbBlob) {
          const thumbFile = new File([thumbBlob], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' })
          const pres2 = await presign(thumbFile.name, 'image/jpeg', 'album-thumbs')
          await xhrPut(pres2.uploadUrl, thumbFile, () => {})
          updateRow(localId, { thumbnail: pres2.publicUrl, status: '✅ Uploaded + thumb' })
        } else {
          updateRow(localId, { thumbnail: publicUrl })
        }
      }
    } catch (e) { updateRow(localId, { status: `❌ ${e instanceof Error ? e.message : 'failed'}` }) } finally { setInFlight(v => v - 1) }
  }

  function addRowWithFile(file: File) {
    const type: 'video' | 'image' = file.type.startsWith('video/') ? 'video' : 'image'
    const id = nextId.current++
    const title = file.name.replace(/\.[^/.]+$/, '')
    setRows(r => [...r, { localId: id, type, title, r2_url: '', thumbnail: '', fileName: file.name, progress: 0, status: 'Queued', hasFile: false }])
    setTimeout(() => { void uploadForRow(file, id, type) }, 10)
  }

  async function handleBulk(files: FileList | null) {
    if (!files) return
    const list = Array.from(files).filter(f => f.type.startsWith('video/') || f.type.startsWith('image/'))
    if (!list.length) { alert('No videos or images detected'); return }
    setBulkInfo({ active: true, done: 0, total: list.length })
    let done = 0
    const queue = [...list]; let idx = 0
    const CONC = 3
    async function worker() {
      while (idx < queue.length) {
        const file = queue[idx++]
        addRowWithFile(file)
        // wait a tick so row created before next
        await new Promise(r => setTimeout(r, 50))
        done++; setBulkInfo(s => ({ ...s, done }))
      }
    }
    // Actually upload is triggered per row, but bulk progress tracks queue dispatch.
    // Use concurrent workers for dispatch
    const workers = Array.from({ length: Math.min(CONC, queue.length) }, () => worker())
    await Promise.all(workers)
    setBulkInfo(s => ({ ...s, active: false }))
  }

  function addEmptyRow() {
    const id = nextId.current++
    setRows(r => [...r, { localId: id, type: 'video', title: '', r2_url: '', thumbnail: '', fileName: '', progress: 0, status: '', hasFile: false }])
  }

  async function saveItems() {
    if (!selected) { alert('Choose an album'); return }
    if (inFlight > 0) { alert('Wait for uploads to finish'); return }
    const payload = rows.filter(r => r.r2_url.trim()).map(r => ({ type: r.type, title: r.title.trim(), r2_url: r.r2_url.trim(), thumbnail: r.thumbnail.trim() }))
    if (!payload.length) { alert('No items with R2 URL'); return }
    setSaving(true)
    try {
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/albums/${selected}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': getAdminToken() }, body: JSON.stringify({ items: payload }) })
      if (!r.ok) { if (r.status === 401) { onAuthError(); return } const j = await r.json().catch(() => null); throw new Error(j?.error ?? `HTTP ${r.status}`) }
      setNotice(`✅ Saved ${payload.length} items`); setRows([]); load(page); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') } finally { setSaving(false) }
  }

  async function delAlbum(id: string) {
    if (!window.confirm('Delete album and all its items?')) return
    try {
      const r = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/albums/${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() } })
      if (!r.ok) { if (r.status === 401) { onAuthError(); return } throw new Error(`HTTP ${r.status}`) }
      setNotice('Deleted'); if (albums.length === 1 && page > 1) setPage(page - 1); else load(page); onChanged()
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed') }
  }

  return <div className="page-content album-admin">
    <div className="page-heading">Manage Albums</div>
    <div className="page-sub">{fmtNumber(total)} albums · {PER} per page</div>
    {notice && <div className="manage-notice">{notice}</div>}
    {err && <div className="msg error">{err}</div>}

    <div className="card">
      <div className="card-header">Upload Items to Album</div>
      <div className="card-body">
        <label className="lbl">Select Album</label>
        <select value={selected} onChange={e => setSelected(e.target.value)} required>
          <option value="">Choose album...</option>
          {albums.map(a => <option key={a.$id} value={a.$id}>{a.title} ({a.item_count ?? 0} items)</option>)}
        </select>

        <div className={`bulk-dropzone ${bulkInfo.active ? 'dragover' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleBulk(e.dataTransfer.files) }} onClick={() => bulkInputRef.current?.click()}>
          <input ref={bulkInputRef} type="file" accept="video/*,image/*" multiple onChange={e => { handleBulk(e.target.files); if (e.target) (e.target as HTMLInputElement).value = '' }} />
          <div className="bulk-icon">📦</div>
          <div className="bulk-title">Drop multiple files here, or click to select</div>
          <div className="bulk-sub">Videos and images mixed — <strong>type auto-detected</strong>. Up to 3 at a time.</div>
        </div>
        {bulkInfo.total > 0 && <div className={`bulk-status ${bulkInfo.active ? 'active' : ''}`} style={{ display: bulkInfo.total ? 'block' : 'none' }}><div className="bulk-status-line"><span><strong>{bulkInfo.done === bulkInfo.total ? '✅ All queued' : 'Uploading...'}</strong></span><span>{bulkInfo.done} / {bulkInfo.total}</span></div><div className="bulk-status-progress"><div className="bulk-status-fill" style={{ width: `${bulkInfo.total ? Math.round(bulkInfo.done / bulkInfo.total * 100) : 0}%` }} /></div></div>}

        <div className="divider">Or add one at a time</div>
        <div id="itemRows">
          {rows.map(row => (
            <div key={row.localId} className="item-row">
              <div className="item-row-header"><span className="item-num">Item {row.localId + 1}</span><button type="button" className="remove-item" onClick={() => setRows(r => r.filter(x => x.localId !== row.localId))}>✕ Remove</button></div>
              <input type="hidden" value={row.type} />
              <div className="type-toggle">
                <div className={`type-btn ${row.type === 'video' ? 'active-video' : ''}`} onClick={() => updateRow(row.localId, { type: 'video' })}>🎬 Video</div>
                <div className={`type-btn ${row.type === 'image' ? 'active-image' : ''}`} onClick={() => updateRow(row.localId, { type: 'image' })}>🖼 Image</div>
              </div>
              <div className="grid2">
                <div className="full">
                  <label className="lbl">{row.type === 'video' ? 'Video File *' : 'Image File *'}</label>
                  <div className={`dropzone ${row.hasFile ? 'has-file' : ''}`}>
                    <input type="file" accept={row.type === 'video' ? 'video/*' : 'image/*'} onChange={e => { const f = e.target.files?.[0]; if (f) { updateRow(row.localId, { type: f.type.startsWith('video/') ? 'video' : 'image', title: f.name.replace(/\.[^/.]+$/, ''), fileName: f.name }); void uploadForRow(f, row.localId, f.type.startsWith('video/') ? 'video' : 'image') } }} />
                    <div className="dz-icon">{row.type === 'video' ? '🎬' : '🖼'}</div>
                    <div className="dz-text"><strong>Click or drag</strong> your file here</div>
                    {row.fileName && <div className="dz-filename" style={{ display: 'block' }}>📁 {row.fileName}</div>}
                  </div>
                  <div className="upload-progress" style={{ display: row.progress > 0 ? 'block' : 'none' }}><div className="prog-bg"><div className="prog-fill" style={{ width: `${row.progress}%` }} /></div><div className="prog-label">Uploading {row.progress}%...</div></div>
                  {row.status && <div className={`upload-status ${row.status.startsWith('✅') ? 'ok' : row.status.startsWith('❌') ? 'err' : ''}`} style={{ display: 'block' }}>{row.status}</div>}
                </div>
                <div className="full">
                  <label className="lbl">R2 URL (auto-filled)</label>
                  <div className="r2-url-wrap"><input value={row.r2_url} onChange={e => updateRow(row.localId, { r2_url: e.target.value })} placeholder="Auto-filled after upload" /><span className="r2-ready-badge" style={{ display: row.r2_url ? 'inline-block' : 'none' }}>✓ Ready</span></div>
                </div>
                <div className="full">
                  <label className="lbl">Thumbnail URL</label>
                  <input value={row.thumbnail} onChange={e => updateRow(row.localId, { thumbnail: e.target.value })} placeholder="Auto-generated from video or image" />
                  {row.thumbnail && <img src={row.thumbnail} alt="" className="thumb-preview" style={{ display: 'block' }} />}
                </div>
                <div className="full">
                  <label className="lbl">Title (optional)</label>
                  <input value={row.title} onChange={e => updateRow(row.localId, { title: e.target.value })} placeholder="Caption or title" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn-add-item" onClick={addEmptyRow}>+ Add Another Item</button>
        <button type="button" className="btn-primary" onClick={saveItems} disabled={saving || inFlight > 0}>{saving ? 'Saving…' : inFlight > 0 ? `⏳ ${inFlight} uploads…` : '💾 Save All Items'}</button>
      </div>
    </div>

    <div className="card">
      <div className="card-header">All Albums <a href="/albums" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#ff6b35', textDecoration: 'none', fontWeight: 600 }}>View Grid →</a></div>
      {loading ? <div className="empty">Loading…</div> : albums.length ? (
        <div className="albums-grid admin-grid">
          {albums.map(a => (
            <div key={a.$id} className="album-card admin">
              {a.thumbnail ? <img src={a.thumbnail} alt="" className="album-thumb" /> : <div className="album-thumb-ph">🎬</div>}
              <div className="album-info">
                <div className="album-title">{a.title}</div>
                <div className="album-meta">{a.item_count ?? 0} items{(a.is_premium === 'yes' || String(a.is_premium) === '1') ? ' · ⭐ Premium' : ''}</div>
                <div className="album-slug">/a/{a.slug}</div>
                <div className="album-actions">
                  <a href={`/a/${encodeURIComponent(a.slug)}`} target="_blank" rel="noopener noreferrer" className="btn-sm btn-blue">🔗 View</a>
                  <button className="btn-sm btn-red" onClick={() => delAlbum(a.$id)}>🗑 Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="empty">No albums yet.</div>}
      <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button></div>
    </div>
  </div>
}
