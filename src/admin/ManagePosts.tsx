import { useEffect, useState } from 'react'
import '../AdminPortal.css'
import { getAdminToken } from './auth'
import PostForm, { type EditablePost } from './PostForm'
import { fmtNumber, timeAgo } from '../lib/format'
import type { Post } from '../types/post'

const PER = 20

export default function ManagePosts({ onAuthError, onChanged }: { onAuthError: () => void; onChanged: () => void }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<Post | null>(null)
  const pages = Math.max(1, Math.ceil(total / PER))

  async function load(p: number) {
    setLoading(true); setError(''); setNotice('')
    try {
      const response = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/posts?page=${p}&per=${PER}`, { method: 'GET', headers: { 'X-Admin-Token': getAdminToken() } })
      if (!response.ok) { if (response.status === 401) { onAuthError(); return } throw new Error(`HTTP ${response.status}`) }
      const data = await response.json() as { total: number; posts: Post[] }
      setTotal(data.total); setPosts(data.posts)
    } catch (err) { setError(`Could not load posts. ${err instanceof Error ? err.message : 'Check the Worker.'}`) } finally { setLoading(false) }
  }

  useEffect(() => { const t = setTimeout(() => { void load(page) }, 0); return () => clearTimeout(t) }, [page])

  const del = async (post: Post) => {
    if (!window.confirm(`Delete “${post.title}”? This removes the post and its image.`)) return
    setError('')
    try {
      const response = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/posts/${post.$id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() } })
      if (!response.ok) { if (response.status === 401) { onAuthError(); return } throw new Error(`HTTP ${response.status}`) }
      setNotice(`Deleted “${post.title}”.`)
      if (posts.length === 1 && page > 1) setPage(page - 1); else load(page)
      onChanged()
    } catch (err) { setError(`Could not delete. ${err instanceof Error ? err.message : 'Check the Worker.'}`) }
  }

  return <div className="page-content">
    <div className="page-heading">{editing ? `Edit “${editing.title}”` : 'Manage Posts'}</div>
    <div className="page-sub">{editing ? 'Update the details below, then save.' : `${fmtNumber(total)} posts · showing ${PER} per page`}</div>
    {editing
      ? <div className="admin admin-form"><PostForm initial={editing as EditablePost} onAuthError={onAuthError} onSaved={() => { setEditing(null); setNotice('Post updated.'); load(page); onChanged() }} onCancel={() => setEditing(null)} /></div>
      : <>
          {notice && <div className="manage-notice">{notice}</div>}
          {error && <div className="empty-state">{error}</div>}
          {loading ? <div className="table-card"><div className="empty-state">Loading posts…</div></div>
            : posts.length === 0 ? <div className="table-card"><div className="empty-state">No posts found.</div></div>
              : <div className="table-card"><table><thead><tr><th>Post</th><th>Status</th><th>Category</th><th>Premium</th><th>Views</th><th>Link Clicks</th><th>Added</th><th>Actions</th></tr></thead><tbody>{posts.map(post => (
                <tr key={post.$id}><td className="td-title"><img className="post-thumb" src={post.image_url} alt={post.title} /><span><a href={`/${post.slug}`} target="_blank" rel="noopener noreferrer">{post.title}</a><small>/{post.slug}</small></span></td><td><span className={`status-badge ${post.status}`}>{post.status}</span></td><td className="td-category">{post.category}</td><td className="td-category">{post.is_premium === 'yes' ? 'Exclusive' : 'Free'}</td><td className="td-views">🔥 {fmtNumber(post.views)}</td><td className="td-views">🔗 {fmtNumber(post.link_clicks)}</td><td className="td-time">{timeAgo(post.created_at)}</td><td className="td-actions"><button className="edit-btn" onClick={() => setEditing(post)}>Edit</button><button className="delete-btn" onClick={() => del(post)}>Delete</button></td></tr>
              ))}</tbody></table></div>}
          <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button></div>
        </>}
  </div>
}