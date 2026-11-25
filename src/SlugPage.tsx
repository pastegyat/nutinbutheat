import { useEffect, useState } from 'react'
import PostDetail from './PostDetail'
import PasteDetail from './PasteDetail'
import { getPasteBySlug, getPostBySlug, type Paste } from './lib/appwrite'

// Root slugs are shared: posts take precedence, text pastes are the fallback.
// The fetched paste is passed through so PasteDetail doesn't refetch
// (each GET /pastes/:slug counts +1 view — refetching would double-count).
export default function SlugPage({ slug = '' }: { slug?: string }) {
  const [kind, setKind] = useState<'post' | 'paste' | 'missing' | null>(null)
  const [paste, setPaste] = useState<Paste | null>(null)
  useEffect(() => {
    let cancelled = false
    setKind(null); setPaste(null)
    ;(async () => {
      if (slug && await getPostBySlug(slug)) { if (!cancelled) setKind('post'); return }
      if (cancelled) return
      const found = slug ? await getPasteBySlug(slug) : null
      if (cancelled) return
      if (found) { setPaste(found); setKind('paste') } else { setKind('missing') }
    })()
    return () => { cancelled = true }
  }, [slug])
  if (kind === 'post') return <PostDetail slug={slug} />
  if (kind === 'paste') return <PasteDetail slug={slug} initialPaste={paste} />
  if (kind === 'missing') return <div className="detail-page"><main className="detail-main"><p className="no-results">Not found.</p></main></div>
  return <div className="detail-page"><main className="detail-main"><p className="no-results">Loading…</p></main></div>
}
