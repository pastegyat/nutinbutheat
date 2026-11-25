import { useEffect, useRef, useState } from 'react'
import { getAlbumBySlug } from './lib/appwrite'
import { timeAgo } from './lib/format'
import { linkTo } from './lib/router'
import type { Album } from './types/album'

const FRAME_MS = 1200
const MAX_SLIDES = 8

// AlbumId -> slideshow frames (cover excluded; index 0 in state always means cover).
const slidesCache = new Map<string, string[]>()

export default function AlbumCard({ album }: { album: Album }) {
  const cover = (album.cover || album.thumbnail || '') as string
  const isPremium = album.is_premium === 'yes' || album.is_premium === true as unknown as string || String(album.is_premium) === '1'
  const [frame, setFrame] = useState(0)
  const hoverRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setFrame(0)
  }

  useEffect(() => stop, [])

  const start = () => {
    hoverRef.current = true
    const itemCount = album.item_count ?? 0
    if (itemCount <= 1) return
    const cached = slidesCache.get(album.$id)
    if (cached) {
      if (cached.length > 0) play(cached)
      return
    }
    // Fetch item thumbnails on first hover; play once loaded if still hovering.
    void (async () => {
      try {
        const data = await getAlbumBySlug(album.slug)
        if (!hoverRef.current) return
        const seen = new Set<string>(); const frames: string[] = []
        for (const it of data?.items ?? []) {
          const src = (it.thumbnail || (it.type === 'image' ? it.r2_url : '') || '').trim()
          if (!src || seen.has(src)) continue
          seen.add(src); frames.push(src)
          // Preload to avoid flashing on first cycle.
          const pre = new Image(); pre.src = src
          if (frames.length >= MAX_SLIDES) break
        }
        slidesCache.set(album.$id, frames)
        if (hoverRef.current && frames.length > 0) play(frames)
      } catch { /* slideshow is decorative; cover stays */ }
    })()
  }

  const play = (frames: string[]) => {
    if (timerRef.current || frames.length === 0) return
    let i = 0
    timerRef.current = setInterval(() => {
      i = (i + 1) % (frames.length + 1)
      setFrame(i)
    }, FRAME_MS)
  }

  const leave = () => { hoverRef.current = false; stop() }

  const slides = slidesCache.get(album.$id) ?? []
  const src = frame === 0 ? cover : (slides[frame - 1] ?? cover)

  return (
    <a href={`/a/${encodeURIComponent(album.slug)}`} onClick={linkTo(`/a/${album.slug}`)} className="album-card" onMouseEnter={start} onMouseLeave={leave}>
      <div className="album-mosaic">
        {src ? <img key={src} src={src} className="mosaic-single slide-fade" loading="lazy" alt="" /> : <div className="mosaic-placeholder">🎞</div>}
        {isPremium && <span className="prem-badge">★ Premium</span>}
        {slides.length > 0 && frame > 0 && <span className="slide-count">{frame}/{slides.length}</span>}
        <div className="album-mosaic-overlay">
          {(album.video_count ?? 0) > 0 && <span className="count-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg> {album.video_count}</span>}
          {(album.image_count ?? 0) > 0 && <span className="count-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> {album.image_count}</span>}
        </div>
      </div>
      <div className="album-info">
        <div className="album-title">{album.title}</div>
        <div className="album-meta">
          <span className="meta-item">{album.item_count ?? 0} item{(album.item_count ?? 0) !== 1 ? 's' : ''}</span>
          <span className="meta-dot">•</span>
          <span className="meta-item">{timeAgo(album.created_at)}</span>
        </div>
      </div>
    </a>
  )
}
