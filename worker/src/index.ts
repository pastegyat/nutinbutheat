export interface Env {
  ASSETS: Fetcher
  POST_IMAGES: R2Bucket
  APPWRITE_ENDPOINT: string
  APPWRITE_PROJECT_ID: string
  APPWRITE_DATABASE_ID: string
  APPWRITE_POSTS_COLLECTION_ID: string
  APPWRITE_REACTIONS_COLLECTION_ID: string
  APPWRITE_POST_EVENTS_COLLECTION_ID: string
  APPWRITE_ANALYTICS_COLLECTION_ID: string
  APPWRITE_ALBUMS_COLLECTION_ID: string
  APPWRITE_ALBUM_ITEMS_COLLECTION_ID: string
  APPWRITE_CONTACT_COLLECTION_ID: string
  TURNSTILE_SECRET: string
  APPWRITE_API_KEY: string
  R2_PUBLIC_BASE_URL: string
  ADMIN_EMAIL: string
  ADMIN_PASSWORD: string
  ADMIN_TOKEN_SECRET: string
  IP_HASH_SECRET: string
}

const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://nutinbutheat.com', 'https://www.nutinbutheat.com']
function corsHeaders(origin: string | null) { const o = origin ?? ''; const allow = ALLOWED_ORIGINS.includes(o) || o.endsWith('.vercel.app') ? o : ALLOWED_ORIGINS[0]; return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS', 'Vary': 'Origin' } }
const sanitizeSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, '-')

async function appwrite(env: Env, path: string, init: RequestInit = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Appwrite-Project': env.APPWRITE_PROJECT_ID, ...(init.headers ?? {}) } as Record<string, string>
  if (!('X-Appwrite-JWT' in headers)) headers['X-Appwrite-Key'] = env.APPWRITE_API_KEY
  return fetch(`${env.APPWRITE_ENDPOINT}${path}`, { ...init, headers })
}
async function isAdmin(request: Request, env: Env) {
  const token = request.headers.get('X-Admin-Token'); if (!token) return { ok: false, reason: 'missing-token' }
  const ok = await verifyToken(env.ADMIN_TOKEN_SECRET, token); if (!ok) return { ok: false, reason: 'invalid-token' }
  return { ok: true }
}
const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlDecode = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'))
async function signToken(secret: string) {
  const payload = b64url(JSON.stringify({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payload}.${b64url(String.fromCharCode(...new Uint8Array(sigBuf)))}`
}
async function verifyToken(secret: string, token: string) {
  const [payload, sig] = token.split('.'); if (!payload || !sig) return false
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify('HMAC', key, Uint8Array.from(b64urlDecode(sig), c => c.charCodeAt(0)), new TextEncoder().encode(payload))
    if (!ok) return false
    const data = JSON.parse(b64urlDecode(payload)) as { sub?: string; exp?: number }
    return data.sub === 'admin' && typeof data.exp === 'number' && data.exp > Math.floor(Date.now() / 1000)
  } catch { return false }
}
async function hash(value: string, secret: string) { const bytes = new TextEncoder().encode(`${secret}:${value}`); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('') }
async function hmacHex(secret: string, data: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)); return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('') }
function sanitizeFilename(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) }
async function getDocument(env: Env, collectionId: string, documentId: string) { const response = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${collectionId}/documents/${documentId}`); return response.ok ? response.json() as Promise<Record<string, unknown>> : null }
async function updateDocument(env: Env, collectionId: string, documentId: string, data: Record<string, unknown>) { return appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${collectionId}/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify({ data }) }) }
async function getReactionTotals(env: Env, postId: string) {
  const query = JSON.stringify({ method: 'equal', attribute: 'post_id', values: [postId] })
  const reactionResponse = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_REACTIONS_COLLECTION_ID}/documents?queries[]=${encodeURIComponent(query)}`)
  const all = reactionResponse.ok ? await reactionResponse.json() as { documents: Array<{ type: string }> } : { documents: [] }
  return { likes: all.documents.filter(item => item.type === 'like').length, dislikes: all.documents.filter(item => item.type === 'dislike').length }
}
async function listAllDocs(env: Env, collectionId: string, queries: Array<Record<string, unknown>>, max = 20000) {
  const all: Array<Record<string, unknown>> = []; let offset = 0
  while (all.length < max) {
    const parts = queries.map(q => `queries[]=${encodeURIComponent(JSON.stringify(q))}`)
    parts.push(`queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] }))}`)
    if (offset) parts.push(`queries[]=${encodeURIComponent(JSON.stringify({ method: 'offset', values: [offset] }))}`)
    const res = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${collectionId}/documents?${parts.join('&')}`)
    if (!res.ok) throw new Error(`read failed (${res.status})`)
    const page = await res.json() as { documents: Array<Record<string, unknown>> }
    all.push(...page.documents)
    if (page.documents.length < 1000) break
    offset += 1000
  }
  return all
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const inflight = new Map<string, Promise<Response>>()
const evRates = new Map<string, { n: number; t: number }>()
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|python-requests|curl\/|wget|headless/i
async function cachedJson(ctx: ExecutionContext | undefined, cacheKey: string, ttl: number, build: () => Promise<Response>): Promise<Response> {
  const cache = caches.default
  const req = new Request(cacheKey)
  const hit = await cache.match(req)
  if (hit) { const r = new Response(hit.body, hit); r.headers.set('X-Cache', 'HIT'); return r }
  const existing = inflight.get(cacheKey)
  if (existing) { const r = await existing; const out = new Response(r.body, r); out.headers.set('X-Cache', 'COALESCED'); return out }
  const p = (async () => {
    let fresh: Response
    try { fresh = await build() }
    catch {
      const stale = await cache.match(req.url + ':stale')
      if (stale) { const r = new Response(stale.body, stale); r.headers.set('X-Cache', 'STALE'); return r }
      throw new Error('upstream failed')
    }
    const ok = new Response(fresh.body, fresh)
    ok.headers.set('X-Cache', 'MISS')
    ok.headers.set('Cache-Control', `public, max-age=${ttl}`)
    if (ctx) {
      ctx.waitUntil(cache.put(req, ok.clone()))
      const staleRes = new Response(ok.clone().body, ok)
      staleRes.headers.set('Cache-Control', 'public, max-age=86400')
      ctx.waitUntil(cache.put(new Request(req.url + ':stale'), staleRes))
    }
    return ok
  })()
  inflight.set(cacheKey, p)
  try { return await p } finally { inflight.delete(cacheKey) }
}
function replaceMeta(html: string, key: string, value: string) {
  const attr = key.startsWith('twitter') ? 'name' : 'property'
  const re = new RegExp(`(<meta[^>]*${attr}="${key}"[^>]*content=")[^"]*(")`, 'i')
  if (re.test(html)) return html.replace(re, `$1${escHtml(value)}$2`)
  return html.replace('</head>', `<meta ${attr}="${key}" content="${escHtml(value)}" /></head>`)
}
async function buildCrawlerHtml(request: Request, url: URL, env: Env): Promise<string | null> {
  const path = url.pathname.replace(/^\/+|\/+$/g, '')
  let title: string; let description: string; let image: string; let canonical: string
  if (path.startsWith('a/')) {
    const slug = decodeURIComponent(path.slice(2))
    if (!slug) return null
    const qEnc = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'slug', values: [slug] }))
    const res = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ALBUMS_COLLECTION_ID}/documents?queries[]=${qEnc}&queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }))}`)
    if (!res.ok) return null
    const data = await res.json() as { documents: Array<Record<string, unknown>> }; const album = data.documents[0]
    if (!album) return null
    title = String(album.title ?? '')
    description = String(album.description ?? '').slice(0, 160)
    image = String(album.thumbnail ?? '')
    canonical = `https://nutinbutheat.com/a/${slug}`
  } else if (path && !['albums', 'trending', 'about', 'privacy', 'terms', 'contact', 'categories', 'nadmin'].includes(path)) {
    const slug = decodeURIComponent(path)
    const qEnc = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'slug', values: [slug] }))
    const res = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents?queries[]=${qEnc}&queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }))}`)
    if (!res.ok) return null
    const data = await res.json() as { documents: Array<Record<string, unknown>> }; const post = data.documents[0]
    if (!post || String(post.status ?? '') !== 'public') return null
    title = String(post.title ?? '')
    description = String(post.description ?? '').slice(0, 160)
    image = String(post.image_url ?? '')
    canonical = `https://nutinbutheat.com/${slug}`
  } else {
    return null
  }
  if (!title) return null
  const pageRes = await env.ASSETS.fetch(new Request('https://assets.local/'))
  let html = await pageRes.text()
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escHtml(title)} - NutinButHeat</title>`)
  html = replaceMeta(html, 'og:title', title)
  html = replaceMeta(html, 'og:description', description)
  if (image) html = replaceMeta(html, 'og:image', image)
  html = replaceMeta(html, 'og:url', canonical)
  html = replaceMeta(html, 'twitter:card', 'summary_large_image')
  html = replaceMeta(html, 'twitter:title', title)
  html = replaceMeta(html, 'twitter:description', description)
  if (image) html = replaceMeta(html, 'twitter:image', image)
  return html
}

export default { async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
  const cors = corsHeaders(request.headers.get('Origin'))
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  const url = new URL(request.url)
  if (request.method === 'POST' && url.pathname === '/track') {
    if (BOT_RE.test(request.headers.get('User-Agent') ?? '')) return json({ ok: true, skipped: true })
    const body = await request.json() as { path?: string; search?: string; id?: string; duration_ms?: number }
    const base = `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ANALYTICS_COLLECTION_ID}/documents`
    if (typeof body.id === 'string' && body.id) {
      const data: Record<string, unknown> = {}
      if (typeof body.search === 'string' && body.search.trim()) data.search_term = body.search.trim().slice(0, 128)
      if (typeof body.duration_ms === 'number') data.duration_ms = Math.max(0, Math.round(body.duration_ms))
      if (Object.keys(data).length === 0) return json({ ok: true })
      const updated = await appwrite(env, `${base}/${body.id}`, { method: 'PATCH', body: JSON.stringify({ data }) })
      if (!updated.ok) return json({ error: 'Could not finalize pageview.' }, 502)
      return json({ ok: true })
    }
    const cleanPath = typeof body.path === 'string' ? body.path.trim().slice(0, 200) : ''; if (!cleanPath.startsWith('/')) return json({ error: 'Invalid path.' }, 400)
    const searchTerm = typeof body.search === 'string' && body.search.trim() ? body.search.trim().slice(0, 128) : null
    const created = await appwrite(env, base, { method: 'POST', body: JSON.stringify({ documentId: 'unique()', data: { path: cleanPath, search_term: searchTerm, created_at: new Date().toISOString() }, permissions: [] }) })
    if (!created.ok) return json({ error: 'Could not record pageview.' }, 502)
    const doc = await created.json() as { $id?: string }
    return json({ ok: true, id: doc.$id ?? null })
  }
  if (request.method === 'GET' && url.pathname === '/reactions/all') {
    return cachedJson(ctx, 'https://cache.local/reactions/all', 60, async () => {
      const docs = await listAllDocs(env, env.APPWRITE_REACTIONS_COLLECTION_ID, [], 20000)
      const map: Record<string, { likes: number; dislikes: number }> = {}
      for (const d of docs) {
        const pid = String((d as Record<string, unknown>).post_id ?? ''); if (!pid) continue
        map[pid] ??= { likes: 0, dislikes: 0 }
        const t = String((d as Record<string, unknown>).type ?? '')
        if (t === 'like') map[pid].likes += 1; else if (t === 'dislike') map[pid].dislikes += 1
      }
      return new Response(JSON.stringify(map), { headers: { ...corsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' } })
    })
  }
  if (request.method === 'GET' && url.pathname === '/posts/all') {
    return cachedJson(ctx, 'https://cache.local/posts/all', 600, async () => {
      const posts = await listAllDocs(env, env.APPWRITE_POSTS_COLLECTION_ID, [{ method: 'equal', attribute: 'status', values: ['public'] }, { method: 'orderDesc', attribute: 'created_at' }], 5000)
      const trimmed = posts.map(p => ({ $id: String((p as Record<string, unknown>).$id ?? ''), title: String((p as Record<string, unknown>).title ?? ''), slug: String((p as Record<string, unknown>).slug ?? ''), description: String((p as Record<string, unknown>).description ?? ''), image_url: String((p as Record<string, unknown>).image_url ?? ''), category: String((p as Record<string, unknown>).category ?? ''), is_premium: (p as Record<string, unknown>).is_premium ?? 'no', status: String((p as Record<string, unknown>).status ?? 'public'), views: Number((p as Record<string, unknown>).views ?? 0) || 0, link_clicks: Number((p as Record<string, unknown>).link_clicks ?? 0) || 0, created_at: String((p as Record<string, unknown>).created_at ?? '') }))
      return new Response(JSON.stringify({ posts: trimmed }), { headers: { ...corsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' } })
    })
  }
  if (request.method === 'GET' && url.pathname === '/albums') {
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const q = (url.searchParams.get('q') ?? '').trim()
    return cachedJson(ctx, `https://cache.local/albums?p=${page}&per=${per}&q=${encodeURIComponent(q)}`, 120, async () => {
    const albumsCol = env.APPWRITE_ALBUMS_COLLECTION_ID; const itemsCol = env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID
    try {
      let total = 0; let pageAlbums: Array<Record<string, unknown>> = []
      const isPremium = (v: unknown) => v === 'yes' || v === true || v === 1 || String(v).toLowerCase() === 'yes' || String(v) === '1'
      const all = await listAllDocs(env, albumsCol, [{ method: 'orderDesc', attribute: 'created_at' }], 5000)
      let filtered = all.filter(a => !isPremium((a as Record<string, unknown>).is_premium))
      if (q) {
        const low = q.toLowerCase()
        filtered = filtered.filter(a => String((a as Record<string, unknown>).title ?? '').toLowerCase().includes(low) || String((a as Record<string, unknown>).description ?? '').toLowerCase().includes(low))
      }
      total = filtered.length; const off = (page - 1) * per; pageAlbums = filtered.slice(off, off + per)
      const ids = pageAlbums.map(a => String((a as Record<string, unknown>).$id ?? ''))
      let allItems: Array<Record<string, unknown>> = []
      if (ids.length) {
        try { allItems = await listAllDocs(env, itemsCol, [{ method: 'equal', attribute: 'album_id', values: ids }], 5000) } catch { allItems = [] }
      }
      const enriched = pageAlbums.map(a => {
        const aid = String((a as Record<string, unknown>).$id ?? ''); const thumb: string = String((a as Record<string, unknown>).thumbnail ?? '')
        const related = allItems.filter(it => String((it as Record<string, unknown>).album_id ?? '') === aid)
        const item_count = related.length; const video_count = related.filter(it => String((it as Record<string, unknown>).type ?? '') === 'video').length; const image_count = related.filter(it => String((it as Record<string, unknown>).type ?? '') === 'image').length
        let cover = thumb; if (!cover) { related.sort((x, y) => { const sx = Number((x as Record<string, unknown>).sort_order ?? 0); const sy = Number((y as Record<string, unknown>).sort_order ?? 0); if (sx !== sy) return sx - sy; return String((x as Record<string, unknown>).$id ?? '').localeCompare(String((y as Record<string, unknown>).$id ?? '')) }); const first = related.find(it => String((it as Record<string, unknown>).thumbnail ?? '').trim() !== ''); if (first) cover = String((first as Record<string, unknown>).thumbnail ?? '') }
        return { ...a, item_count, video_count, image_count, cover }
      })
      return json({ total, page, per, albums: enriched, q })
    } catch (e) { if (String(e).includes('404') || String(e).includes('not found')) return json({ total: 0, page, per, albums: [] }) ; throw e }
    })
  }
  if (request.method === 'GET' && url.pathname.startsWith('/albums/')) {
    const slug = decodeURIComponent(url.pathname.slice('/albums/'.length).replace(/^\/+|\/+$/g, ''))
    if (!slug) return json({ error: 'Missing slug.' }, 400)
    const albumsCol = env.APPWRITE_ALBUMS_COLLECTION_ID; const itemsCol = env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID
    const qEnc = (v: unknown) => encodeURIComponent(JSON.stringify(v))
    const res = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${albumsCol}/documents?queries[]=${qEnc({ method: 'equal', attribute: 'slug', values: [slug] })}&queries[]=${qEnc({ method: 'limit', values: [1] })}`)
    if (!res.ok) return json({ error: 'Album not found.' }, 404)
    const data = await res.json() as { documents: Array<Record<string, unknown>> }; const album = data.documents[0]; if (!album) return json({ error: 'Album not found.' }, 404)
    const ua = request.headers.get('User-Agent') ?? ''; if (!/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview/i.test(ua)) { const vc = Number((album as Record<string, unknown>).view_count ?? 0); appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${albumsCol}/documents/${String((album as Record<string, unknown>).$id ?? '')}`, { method: 'PATCH', body: JSON.stringify({ data: { view_count: vc + 1 } }) }).catch(() => {}) }
    let items: Array<Record<string, unknown>> = []
    try { items = await listAllDocs(env, itemsCol, [{ method: 'equal', attribute: 'album_id', values: [String((album as Record<string, unknown>).$id ?? '')] }], 5000) } catch { items = [] }
    items.sort((a, b) => { const sa = Number((a as Record<string, unknown>).sort_order ?? 0); const sb = Number((b as Record<string, unknown>).sort_order ?? 0); if (sa !== sb) return sa - sb; return String((a as Record<string, unknown>).$id ?? '').localeCompare(String((b as Record<string, unknown>).$id ?? '')) })
    return json({ album, items })
  }
  if (request.method === 'POST' && url.pathname === '/admin/albums/presign') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const { filename, folder } = await request.json() as { filename?: string; folder?: string }
    const allowedFolders = ['album-videos', 'album-images', 'album-thumbs', 'posts']
    const f = String(folder ?? ''); if (!allowedFolders.includes(f)) return json({ error: 'Invalid folder.' }, 400)
    const ext = (String(filename ?? '').split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const baseName = sanitizeFilename(String(filename ?? 'file').replace(/\.[^/.]+$/, ''))
    const key = f === 'posts' ? `posts/${sanitizeFilename(String(filename ?? ''))}` : `${f}/${crypto.randomUUID()}-${baseName}.${ext}`
    const publicUrl = `${env.R2_PUBLIC_BASE_URL}/${key}`
    const expires = String(Math.floor(Date.now() / 1000) + 600)
    const sig = await hmacHex(env.ADMIN_TOKEN_SECRET, `${key}|${expires}`)
    const uploadUrl = `${new URL(request.url).origin}/admin/albums/upload?key=${encodeURIComponent(key)}&expires=${expires}&sig=${encodeURIComponent(sig)}`
    return json({ uploadUrl, publicUrl, key })
  }
  if (request.method === 'PUT' && url.pathname === '/admin/albums/upload') {
    const key = url.searchParams.get('key') ?? ''; const expires = url.searchParams.get('expires') ?? ''; const sig = url.searchParams.get('sig') ?? ''
    if (!key || !expires || !sig) return json({ error: 'Missing presign params.' }, 400)
    if (Number(expires) < Math.floor(Date.now() / 1000)) return json({ error: 'Presigned URL expired.' }, 403)
    const expected = await hmacHex(env.ADMIN_TOKEN_SECRET, `${key}|${expires}`)
    if (sig !== expected) return json({ error: 'Invalid signature.' }, 403)
    const ct = request.headers.get('Content-Type') ?? 'application/octet-stream'
    const buf = await request.arrayBuffer()
    if (buf.byteLength > 500 * 1024 * 1024) return json({ error: 'File too large.' }, 413)
    await env.POST_IMAGES.put(key, buf, { httpMetadata: { contentType: ct } })
    return json({ ok: true, publicUrl: `${env.R2_PUBLIC_BASE_URL}/${key}`, key })
  }
  if (request.method === 'POST' && url.pathname === '/admin/albums') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim(); if (!title) return json({ error: 'Album title is required.' }, 400)
    const description = String(form.get('description') ?? '')
    const is_premium = form.get('is_premium') ? 'yes' : 'no'
    let thumbnail = String(form.get('album_thumbnail') ?? '').trim()
    const thumbFile = form.get('thumbnail_file')
    if (thumbFile instanceof File && thumbFile.size > 0) {
      if (!thumbFile.type.startsWith('image/')) return json({ error: 'Thumbnail must be an image.' }, 400)
      const tkey = `album-thumbs/${crypto.randomUUID()}-${sanitizeFilename(thumbFile.name)}`
      await env.POST_IMAGES.put(tkey, thumbFile.stream(), { httpMetadata: { contentType: thumbFile.type } })
      thumbnail = `${env.R2_PUBLIC_BASE_URL}/${tkey}`
    }
    const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 6)
    const doc = { documentId: crypto.randomUUID(), data: { title, slug, description, thumbnail, is_premium, view_count: 0, created_at: new Date().toISOString() }, permissions: [] }
    const created = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ALBUMS_COLLECTION_ID}/documents`, { method: 'POST', body: JSON.stringify(doc) })
    if (!created.ok) return json({ error: `Album create failed (${created.status}).` }, 502)
    return json(await created.json(), 201)
  }
  if (request.method === 'GET' && url.pathname === '/admin/albums') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const qEnc = (v: unknown) => encodeURIComponent(JSON.stringify(v))
    const res = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ALBUMS_COLLECTION_ID}/documents?queries[]=${qEnc({ method: 'limit', values: [per] })}&queries[]=${qEnc({ method: 'offset', values: [(page - 1) * per] })}&queries[]=${qEnc({ method: 'orderDesc', attribute: 'created_at' })}`)
    if (!res.ok) { if (res.status === 404) return json({ total: 0, page, per, albums: [] }); return json({ error: `Albums read failed (${res.status}).` }, 502) }
    const data = await res.json() as { total: number; documents: Array<Record<string, unknown>> }
    const albums = data.documents
    const ids = albums.map(a => String((a as Record<string, unknown>).$id ?? ''))
    let allItems: Array<Record<string, unknown>> = []
    if (ids.length) { try { allItems = await listAllDocs(env, env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID, [{ method: 'equal', attribute: 'album_id', values: ids }], 5000) } catch { allItems = [] } }
    const enriched = albums.map(a => {
      const aid = String((a as Record<string, unknown>).$id ?? ''); const related = allItems.filter(it => String((it as Record<string, unknown>).album_id ?? '') === aid)
      return { ...a, item_count: related.length }
    })
    return json({ total: data.total, page, per, albums: enriched })
  }
  if (request.method === 'POST' && url.pathname.startsWith('/admin/albums/') && url.pathname.endsWith('/items')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const parts = url.pathname.split('/').filter(Boolean); const albumId = parts[2] ?? ''
    const album = await getDocument(env, env.APPWRITE_ALBUMS_COLLECTION_ID, albumId); if (!album) return json({ error: 'Album not found.' }, 404)
    let items: Array<{ type: string; title: string; r2_url: string; thumbnail: string }> = []
    const ct = request.headers.get('Content-Type') ?? ''
    if (ct.includes('application/json')) {
      const body = await request.json() as { items?: Array<{ type?: string; title?: string; r2_url?: string; thumbnail?: string }> }
      items = (body.items ?? []).map(it => ({ type: String(it.type ?? 'video'), title: String(it.title ?? '').trim(), r2_url: String(it.r2_url ?? '').trim(), thumbnail: String(it.thumbnail ?? '').trim() })).filter(it => it.r2_url)
    } else {
      const form = await request.formData()
      const types = form.getAll('item_type').map(v => String(v)); const titles = form.getAll('item_title').map(v => String(v)); const urls = form.getAll('item_r2_url').map(v => String(v)); const thumbs = form.getAll('item_thumbnail').map(v => String(v))
      for (let i = 0; i < urls.length; i++) { const url2 = String(urls[i] ?? '').trim(); if (!url2) continue; items.push({ type: String(types[i] ?? 'video'), title: String(titles[i] ?? '').trim(), r2_url: url2, thumbnail: String(thumbs[i] ?? '').trim() }) }
    }
    if (!items.length) return json({ error: 'No items to save.' }, 400)
    const existing = await listAllDocs(env, env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID, [{ method: 'equal', attribute: 'album_id', values: [albumId] }], 5000)
    let nextOrder = 1; if (existing.length) nextOrder = Math.max(...existing.map(d => Number((d as Record<string, unknown>).sort_order ?? 0))) + 1
    for (const it of items) {
      const doc = { documentId: crypto.randomUUID(), data: { album_id: albumId, type: it.type === 'image' ? 'image' : 'video', title: it.title, r2_url: it.r2_url, thumbnail: it.thumbnail, sort_order: nextOrder++ }, permissions: [] }
      const created = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID}/documents`, { method: 'POST', body: JSON.stringify(doc) })
      if (!created.ok) return json({ error: `Item save failed (${created.status}).` }, 502)
    }
    if (!String((album as Record<string, unknown>).thumbnail ?? '').trim()) {
      const firstWithThumb = items.find(it => it.thumbnail.trim() !== '')
      if (firstWithThumb) await updateDocument(env, env.APPWRITE_ALBUMS_COLLECTION_ID, albumId, { thumbnail: firstWithThumb.thumbnail })
      else {
        const firstItemWithThumb = existing.find(d => String((d as Record<string, unknown>).thumbnail ?? '').trim() !== '')
        if (firstItemWithThumb) await updateDocument(env, env.APPWRITE_ALBUMS_COLLECTION_ID, albumId, { thumbnail: String((firstItemWithThumb as Record<string, unknown>).thumbnail ?? '') })
      }
    }
    return json({ ok: true, saved: items.length })
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/admin/albums/')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length === 4 && parts[3] === 'items') {
      const albumId = parts[2] ?? ''; const itemId = url.searchParams.get('itemId') ?? url.searchParams.get('id') ?? ''
      if (!itemId) return json({ error: 'Missing itemId.' }, 400)
      const item = await getDocument(env, env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID, itemId) as Record<string, unknown> | null; if (!item) return json({ error: 'Item not found.' }, 404)
      if (String(item.album_id ?? '') !== albumId) return json({ error: 'Item does not belong to this album.' }, 400)
      const del = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID}/documents/${itemId}`, { method: 'DELETE' })
      if (!del.ok) return json({ error: `Delete item failed (${del.status}).` }, 502)
      return json({ ok: true })
    }
    if (parts.length === 3) {
      const albumId = parts[2] ?? ''
      const album = await getDocument(env, env.APPWRITE_ALBUMS_COLLECTION_ID, albumId); if (!album) return json({ error: 'Album not found.' }, 404)
      const thumbUrl = String((album as Record<string, unknown>).thumbnail ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (thumbUrl.startsWith(prefix)) { const k = thumbUrl.slice(prefix.length); if (k.startsWith('album-')) await env.POST_IMAGES.delete(k).catch(() => {}) }
      const items = await listAllDocs(env, env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID, [{ method: 'equal', attribute: 'album_id', values: [albumId] }], 5000)
      for (const it of items) {
        const r2 = String((it as Record<string, unknown>).r2_url ?? ''); if (r2.startsWith(prefix)) { const k = r2.slice(prefix.length); if (k.startsWith('album-')) await env.POST_IMAGES.delete(k).catch(() => {}) }
        const th = String((it as Record<string, unknown>).thumbnail ?? ''); if (th.startsWith(prefix)) { const k = th.slice(prefix.length); if (k.startsWith('album-')) await env.POST_IMAGES.delete(k).catch(() => {}) }
        const iid = String((it as Record<string, unknown>).$id ?? ''); if (iid) await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ALBUM_ITEMS_COLLECTION_ID}/documents/${iid}`, { method: 'DELETE' })
      }
      const del = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_ALBUMS_COLLECTION_ID}/documents/${albumId}`, { method: 'DELETE' })
      if (!del.ok) return json({ error: `Delete album failed (${del.status}).` }, 502)
      return json({ ok: true })
    }
    return json({ error: 'Not found' }, 404)
  }
  if (request.method === 'GET' && url.pathname === '/sitemap.xml') {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const today = new Date().toISOString().slice(0, 10)
    const staticPaths = ['', '/trending', '/albums', '/categories', '/about', '/terms', '/privacy', '/contact']
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for (const p of staticPaths) xml += `  <url><loc>https://nutinbutheat.com${esc(p)}</loc><lastmod>${today}</lastmod><changefreq>${p === '' ? 'hourly' : 'weekly'}</changefreq><priority>${p === '' ? '1.0' : '0.7'}</priority></url>\n`
    try {
      const posts = await listAllDocs(env, env.APPWRITE_POSTS_COLLECTION_ID, [{ method: 'equal', attribute: 'status', values: ['public'] }, { method: 'orderDesc', attribute: 'created_at' }], 5000).catch(() => [] as Array<Record<string, unknown>>)
      for (const p of posts) {
        const slug = String((p as Record<string, unknown>).slug ?? ''); if (!slug) continue
        const lastmod = String((p as Record<string, unknown>).created_at ?? '').slice(0, 10) || today
        xml += `  <url><loc>https://nutinbutheat.com/${encodeURIComponent(slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`
      }
    } catch { /* skip dynamic section on failure */ }
    try {
      const albums = await listAllDocs(env, env.APPWRITE_ALBUMS_COLLECTION_ID, [{ method: 'orderDesc', attribute: 'created_at' }], 5000).catch(() => [] as Array<Record<string, unknown>>)
      const isPremium = (v: unknown) => v === 'yes' || v === true || v === 1 || String(v).toLowerCase() === 'yes' || String(v) === '1'
      for (const a of albums) {
        if (isPremium((a as Record<string, unknown>).is_premium)) continue
        const slug = String((a as Record<string, unknown>).slug ?? ''); if (!slug) continue
        const lastmod = String((a as Record<string, unknown>).created_at ?? '').slice(0, 10) || today
        xml += `  <url><loc>https://nutinbutheat.com/a/${encodeURIComponent(slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`
      }
    } catch { /* skip dynamic section on failure */ }
    xml += '</urlset>'
    return new Response(xml, { headers: { 'Content-Type': 'application/xml;charset=UTF-8', 'Cache-Control': 'public, max-age=3600' } })
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    const isAssetFile = /\.(js|css|png|jpe?g|webp|gif|svg|ico|txt|json|xml|woff2?|ttf|mp4|webm)$/i.test(url.pathname)
    const accept = request.headers.get('Accept') ?? ''
    if (!isAssetFile && accept.includes('text/html')) {
      const ua = request.headers.get('User-Agent') ?? ''
      const isCrawler = /facebookexternalhit|twitterbot|telegrambot|whatsapp|discordbot|slackbot|linkedinbot|embedly|quora link preview|vkshare|preview/i.test(ua)
      if (isCrawler) {
        try {
          const html = await buildCrawlerHtml(request, url, env)
          if (html) return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' } })
        } catch { /* fall through to assets */ }
      }
      const page = await env.ASSETS.fetch(new Request(`https://assets.local${url.pathname}`, { method: 'GET' }))
      if (page.status !== 404) return page
      return env.ASSETS.fetch(new Request('https://assets.local/', { method: 'GET' }))
    }
  }
  if (request.method === 'POST' && url.pathname === '/contact') {
    const body = await request.json() as { name?: string; email?: string; reason?: string; message?: string; website?: string; 'cf-turnstile-response'?: string; turnstile?: string }
    const honeypot = String(body.website ?? '').trim()
    if (honeypot) return json({ error: 'Spam detected' }, 400)
    const token = String(body['cf-turnstile-response'] ?? body.turnstile ?? '').trim()
    if (!token) return json({ error: 'Please complete the CAPTCHA.' }, 400)
    const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown'
    // Turnstile verify
    try {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }).toString() })
      const verifyJson = await verifyRes.json() as { success?: boolean; 'error-codes'?: string[] }
      if (!verifyJson.success) return json({ error: 'CAPTCHA verification failed.' }, 400)
    } catch { return json({ error: 'CAPTCHA verification failed.' }, 400) }
    const name = String(body.name ?? '').trim(); const email = String(body.email ?? '').trim(); const reason = String(body.reason ?? '').trim(); const message = String(body.message ?? '').trim()
    if (!name || !email || !reason || !message) return json({ error: 'Please fill in all fields.' }, 400)
    // Rate limit 3 per 10 min
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    try {
      const recent = await listAllDocs(env, env.APPWRITE_CONTACT_COLLECTION_ID, [{ method: 'equal', attribute: 'ip_address', values: [ip] }, { method: 'greaterThanEqual', attribute: 'created_at', values: [tenMinAgo] }], 10)
      if (recent.length >= 3) return json({ error: 'Too many messages. Please wait a few minutes.' }, 429)
    } catch { /* collection may not exist yet, ignore for count */ }
    const doc = { documentId: crypto.randomUUID(), data: { name, email, reason, message, ip_address: ip, created_at: new Date().toISOString() }, permissions: [] }
    const created = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CONTACT_COLLECTION_ID}/documents`, { method: 'POST', body: JSON.stringify(doc) })
    // Auto-create collection if missing (first time)
    if (!created.ok && created.status === 404) {
      const colRes = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections`, { method: 'POST', body: JSON.stringify({ collectionId: env.APPWRITE_CONTACT_COLLECTION_ID, name: 'contact_messages', permissions: [], documentSecurity: false }) })
      if (colRes.ok) {
        // create attributes (fire-and-forget, then retry)
        const attrs: Array<{ url: string; body: string }> = [
          { url: `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CONTACT_COLLECTION_ID}/attributes/string`, body: JSON.stringify({ key: 'name', size: 256, required: true }) },
          { url: `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CONTACT_COLLECTION_ID}/attributes/string`, body: JSON.stringify({ key: 'email', size: 256, required: true }) },
          { url: `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CONTACT_COLLECTION_ID}/attributes/string`, body: JSON.stringify({ key: 'reason', size: 64, required: true }) },
          { url: `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CONTACT_COLLECTION_ID}/attributes/string`, body: JSON.stringify({ key: 'message', size: 4000, required: true }) },
          { url: `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CONTACT_COLLECTION_ID}/attributes/string`, body: JSON.stringify({ key: 'ip_address', size: 64, required: true }) },
          { url: `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_CONTACT_COLLECTION_ID}/attributes/datetime`, body: JSON.stringify({ key: 'created_at', required: true }) },
        ]
        for (const a of attrs) { await appwrite(env, a.url, { method: 'POST', body: a.body }).catch(() => {}) }
        return json({ error: 'Collection created, please retry.' }, 503)
      }
      return json({ error: 'Could not save message.' }, 502)
    }
    if (!created.ok) return json({ error: 'Could not save message.' }, 502)
    return json({ ok: true })
  }
  if (request.method === 'POST' && url.pathname === '/admin/import-posts') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const body = await request.json() as { wipe?: boolean; posts?: Array<Record<string, unknown>> }
    const list = Array.isArray(body.posts) ? body.posts : []
    let wiped = 0
    if (body.wipe) {
      const existing = await listAllDocs(env, env.APPWRITE_POSTS_COLLECTION_ID, [{ method: 'orderDesc', attribute: 'created_at' }], 5000).catch(() => [] as Array<Record<string, unknown>>)
      for (const doc of existing) {
        const id = String((doc as Record<string, unknown>).$id ?? ''); if (!id) continue
        const img = String((doc as Record<string, unknown>).image_url ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (img.startsWith(prefix)) { const k = img.slice(prefix.length); if (k.startsWith('posts/')) await env.POST_IMAGES.delete(k).catch(() => {}) }
        await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents/${id}`, { method: 'DELETE' }).catch(() => {})
        wiped++
      }
    }
    let created = 0; const errors: string[] = []
    for (const p of list) {
      const title = String((p as Record<string, unknown>).title ?? '').trim().slice(0, 255)
      const slug = sanitizeSlug(String((p as Record<string, unknown>).slug ?? ''))
      const description = String((p as Record<string, unknown>).description ?? '').trim().slice(0, 5000)
      const image_url = String((p as Record<string, unknown>).image_url ?? '').trim()
      const category = String((p as Record<string, unknown>).category ?? 'Ebony').trim().slice(0, 100) || 'Ebony'
      const is_premium = String((p as Record<string, unknown>).is_premium ?? 'no').toLowerCase() === 'yes' ? 'yes' : 'no'
      const status = String((p as Record<string, unknown>).status ?? 'public').toLowerCase() === 'private' ? 'private' : 'public'
      const views = Number((p as Record<string, unknown>).views ?? 0) || 0
      const link_clicks = Number((p as Record<string, unknown>).link_clicks ?? 0) || 0
      const created_at = String((p as Record<string, unknown>).created_at ?? new Date().toISOString())
      if (!title || !slug || !image_url) { errors.push(`skip ${slug || title} missing fields`); continue }
      const doc = { documentId: crypto.randomUUID(), data: { title, slug, description, image_url, category, is_premium, status, views, link_clicks, created_at }, permissions: [] }
      const res = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents`, { method: 'POST', body: JSON.stringify(doc) })
      if (res.ok) created++; else { const txt = await res.text().catch(() => ''); errors.push(`fail ${slug}: ${res.status} ${txt.slice(0,200)}`) }
    }
    return json({ ok: true, wiped, created, errors: errors.slice(0, 20) })
  }
  if (request.method === 'POST' && url.pathname === '/admin/login') {
    const { password } = await request.json() as { password?: string }
    if (!password || password !== env.ADMIN_PASSWORD) return json({ error: 'Invalid password.' }, 401)
    return json({ token: await signToken(env.ADMIN_TOKEN_SECRET) })
  }
  if (request.method === 'POST' && url.pathname === '/admin/posts') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const form = await request.formData(); const title = String(form.get('title') ?? ''); const slug = sanitizeSlug(String(form.get('slug') ?? '')); const image = form.get('image')
    if (!title || !slug || !(image instanceof File)) return json({ error: 'Title, slug, and image are required.' }, 400)
    if (!image.type.startsWith('image/') || image.size > 10 * 1024 * 1024) return json({ error: 'Use an image smaller than 10 MB.' }, 400)
    const key = `posts/${slug}-${crypto.randomUUID()}.${image.name.split('.').pop()?.toLowerCase() || 'webp'}`
    await env.POST_IMAGES.put(key, image.stream(), { httpMetadata: { contentType: image.type }, customMetadata: { originalName: image.name } })
    const document = { documentId: crypto.randomUUID(), data: { title, slug, description: String(form.get('description') ?? ''), image_url: `${env.R2_PUBLIC_BASE_URL}/${key}`, category: String(form.get('category') ?? ''), is_premium: String(form.get('is_premium') ?? 'no'), status: String(form.get('status') ?? 'private'), views: 0, link_clicks: 0, created_at: new Date().toISOString() }, permissions: [] }
    const created = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents`, { method: 'POST', body: JSON.stringify(document) })
    if (!created.ok) { await env.POST_IMAGES.delete(key); return json({ error: 'Appwrite post creation failed.' }, 502) }
    return json(await created.json(), 201)
  }
  if (request.method === 'GET' && url.pathname === '/admin/posts') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const postsCol = `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents`
    const q = (value: unknown) => encodeURIComponent(JSON.stringify(value))
    const res = await appwrite(env, `${postsCol}?queries[]=${q({ method: 'limit', values: [per] })}&queries[]=${q({ method: 'offset', values: [(page - 1) * per] })}&queries[]=${q({ method: 'orderDesc', attribute: 'created_at' })}`)
    if (!res.ok) return json({ error: `List read failed (${res.status}).` }, 502)
    const data = await res.json() as { total: number; documents: unknown[] }
    return json({ total: data.total, page, per, posts: data.documents })
  }
  if (request.method === 'PATCH' && url.pathname.startsWith('/admin/posts/')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const id = url.pathname.split('/').filter(Boolean).pop() ?? ''
    const existing = await getDocument(env, env.APPWRITE_POSTS_COLLECTION_ID, id); if (!existing) return json({ error: 'Post not found.' }, 404)
    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim(); if (!title) return json({ error: 'Title is required.' }, 400)
    const slug = sanitizeSlug(String(form.get('slug') ?? '')); if (!slug) return json({ error: 'Slug is required.' }, 400)
    const dupQuery = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'slug', values: [slug] }))
    const dup = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents?queries[]=${dupQuery}`)
    if (dup.ok) { const dupJson = await dup.json() as { documents: Array<{ $id: string }> }; if (dupJson.documents.some(d => d.$id !== id)) return json({ error: 'That slug is already in use.' }, 400) }
    const data: Record<string, unknown> = { title, slug, description: String(form.get('description') ?? ''), category: String(form.get('category') ?? ''), is_premium: String(form.get('is_premium') ?? 'no'), status: String(form.get('status') ?? 'private') }
    const image = form.get('image')
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith('image/') || image.size > 10 * 1024 * 1024) return json({ error: 'Use an image smaller than 10 MB.' }, 400)
      const key = `posts/${slug}-${crypto.randomUUID()}.${image.name.split('.').pop()?.toLowerCase() || 'webp'}`
      await env.POST_IMAGES.put(key, image.stream(), { httpMetadata: { contentType: image.type }, customMetadata: { originalName: image.name } })
      data.image_url = `${env.R2_PUBLIC_BASE_URL}/${key}`
      const oldUrl = String(existing.image_url ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (oldUrl.startsWith(prefix)) { const oldKey = oldUrl.slice(prefix.length); if (oldKey.startsWith('posts/')) await env.POST_IMAGES.delete(oldKey).catch(() => {}) }
    }
    const updated = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ data }) })
    if (!updated.ok) return json({ error: `Update failed (${updated.status}).` }, 502)
    return json(await updated.json())
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/admin/posts/')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const id = url.pathname.split('/').filter(Boolean).pop() ?? ''
    const existing = await getDocument(env, env.APPWRITE_POSTS_COLLECTION_ID, id); if (!existing) return json({ error: 'Post not found.' }, 404)
    const oldUrl = String(existing.image_url ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (oldUrl.startsWith(prefix)) { const oldKey = oldUrl.slice(prefix.length); if (oldKey.startsWith('posts/')) await env.POST_IMAGES.delete(oldKey).catch(() => {}) }
    const del = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents/${id}`, { method: 'DELETE' })
    if (!del.ok) return json({ error: `Delete failed (${del.status}).` }, 502)
    const cleanup = async (collectionId: string) => { const docs = await listAllDocs(env, collectionId, [{ method: 'equal', attribute: 'post_id', values: [id] }]); for (const d of docs) { const did = String(d.$id ?? ''); if (did) await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${collectionId}/documents/${did}`, { method: 'DELETE' }) } }
    await Promise.all([cleanup(env.APPWRITE_REACTIONS_COLLECTION_ID), cleanup(env.APPWRITE_POST_EVENTS_COLLECTION_ID)])
    return json({ ok: true })
  }
  if (request.method === 'POST' && url.pathname === '/admin/stats') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    return cachedJson(ctx, 'https://cache.local/admin-stats', 60, async () => {
    const postsCol = `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POSTS_COLLECTION_ID}/documents`
    const posts = await appwrite(env, `${postsCol}?queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [5000] }))}&queries[]=${encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: 'created_at' }))}`)
    if (!posts.ok) throw new Error(`stats ${posts.status}`)
    const postsJson = await posts.json() as { total: number; documents: Array<{ title: string; slug: string; status: string; views: number | null; link_clicks: number | null; created_at: string }> }
    const docs = postsJson.documents ?? []
    const topClicked = [...docs].sort((a, b) => (Number(b.link_clicks) || 0) - (Number(a.link_clicks) || 0)).slice(0, 8).map(({ title, link_clicks, slug }) => ({ title, link_clicks: Number(link_clicks) || 0, slug }))
    const totals = { posts: postsJson.total, publicCount: docs.filter(d => d.status === 'public').length, privateCount: docs.filter(d => d.status === 'private').length, postViews: docs.reduce((a, d) => a + (Number(d.views) || 0), 0), linkClicks: docs.reduce((a, d) => a + (Number(d.link_clicks) || 0), 0) }
    const start30 = new Date(Date.now() - 29 * 86400000); start30.setUTCHours(0, 0, 0, 0)
    const analyticsCol = env.APPWRITE_ANALYTICS_COLLECTION_ID
    const analytics = await listAllDocs(env, analyticsCol, [{ method: 'greaterThanEqual', attribute: 'created_at', values: [start30.toISOString()] }])
    const start14 = new Date(Date.now() - 13 * 86400000); start14.setUTCHours(0, 0, 0, 0)
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0)
    const traffic = new Array(14).fill(0).map((_, i) => { const d = new Date(start14); d.setUTCDate(d.getUTCDate() + i); return { day: d.toISOString().slice(0, 10), views: 0 } })
    const byDay = new Map(traffic.map(item => [item.day, item]))
    const pages = new Map<string, number>(); const searches = new Map<string, number>(); const durations = new Map<string, { count: number; total: number }>()
    let todayViews = 0
    for (const row of analytics) {
      const ts = new Date(String(row.created_at ?? '')).getTime()
      const day = String(row.created_at ?? '').slice(0, 10)
      const bucket = byDay.get(day); if (bucket) bucket.views += 1
      if (ts >= todayStart.getTime()) todayViews += 1
      const path = String(row.path ?? ''); if (path) pages.set(path, (pages.get(path) ?? 0) + 1)
      const term = String(row.search_term ?? ''); if (term) searches.set(term, (searches.get(term) ?? 0) + 1)
const rawDur = row.duration_ms; if (path && typeof rawDur === 'number' && Number.isFinite(rawDur) && rawDur >= 0) { const dur = rawDur; const acc = durations.get(path) ?? { count: 0, total: 0 }; acc.count += 1; acc.total += dur; durations.set(path, acc) }
    }
    const topPages = [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, visits]) => { const acc = durations.get(path); return { path, visits, avgDuration: acc && acc.count ? Math.round(acc.total / acc.count) : null } })
    const topSearches = [...searches.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([term, count]) => ({ term, count }))
    return json({ totals, recentPosts: docs.slice(0, 5).map(({ title, views, link_clicks, created_at }) => ({ title, views: Number(views) || 0, link_clicks: Number(link_clicks) || 0, created_at })), topClicked, traffic, todayViews, topPages, topSearches })
    })
  }
  if (request.method === 'POST' && url.pathname === '/events') {
    if (BOT_RE.test(request.headers.get('User-Agent') ?? '')) return json({ ok: true, skipped: true })
    const { postId, event } = await request.json() as { postId?: string; event?: 'view' | 'link_click' }; if (!postId || !['view', 'link_click'].includes(event ?? '')) return json({ error: 'Invalid event.' }, 400)
    const evIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const nowT = Date.now(); const rec = evRates.get(evIp) ?? { n: 0, t: nowT }; if (nowT - rec.t > 60000) { rec.n = 0; rec.t = nowT }; rec.n++; evRates.set(evIp, rec)
    if (rec.n > 90) return json({ ok: true, limited: true })
    const visitor = await hash(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.IP_HASH_SECRET); const eventId = (await hash(`${postId}:${visitor}:${event}`, env.IP_HASH_SECRET)).slice(0, 36)
    const created = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_POST_EVENTS_COLLECTION_ID}/documents`, { method: 'POST', body: JSON.stringify({ documentId: eventId, data: { post_id: postId, visitor_hash: visitor, event_type: event, created_at: new Date().toISOString() }, permissions: [] }) })
    const createdBody = await created.text()
    if (created.status === 409) return json({ ok: true, duplicate: true })
    if (!created.ok) return json({ error: `Could not record event (${created.status}): ${createdBody.slice(0, 300)}` }, 502)
    const post = await getDocument(env, env.APPWRITE_POSTS_COLLECTION_ID, postId); if (!post) return json({ error: 'Post not found.' }, 404)
    const field = event === 'view' ? 'views' : 'link_clicks'; await updateDocument(env, env.APPWRITE_POSTS_COLLECTION_ID, postId, { [field]: Number(post[field] ?? 0) + 1 })
    return json({ ok: true, duplicate: false })
  }
  if (url.pathname === '/reactions') {
    if (request.method === 'GET') { const postId = url.searchParams.get('postId'); if (!postId) return json({ error: 'Missing postId.' }, 400); return json(await getReactionTotals(env, postId)) }
    if (request.method === 'POST') {
      const { postId, type } = await request.json() as { postId?: string; type?: 'like' | 'dislike' }; if (!postId || !['like', 'dislike'].includes(type ?? '')) return json({ error: 'Invalid reaction.' }, 400)
      const visitor = await hash(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.IP_HASH_SECRET); const reactionId = (await hash(`${postId}:${visitor}`, env.IP_HASH_SECRET)).slice(0, 36); const existing = await getDocument(env, env.APPWRITE_REACTIONS_COLLECTION_ID, reactionId)
      let response: Response
      if (existing?.type === type) { response = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_REACTIONS_COLLECTION_ID}/documents/${reactionId}`, { method: 'DELETE' }) }
      else if (existing) { response = await updateDocument(env, env.APPWRITE_REACTIONS_COLLECTION_ID, reactionId, { type }) }
      else { response = await appwrite(env, `/databases/${env.APPWRITE_DATABASE_ID}/collections/${env.APPWRITE_REACTIONS_COLLECTION_ID}/documents`, { method: 'POST', body: JSON.stringify({ documentId: reactionId, data: { post_id: postId, visitor_hash: visitor, type }, permissions: [] }) }) }
      if (!response.ok) return json({ error: `Reaction write failed (${response.status}): ${(await response.text()).slice(0, 200)}` }, 502)
      return json(await getReactionTotals(env, postId))
    }
  }
  return json({ error: 'Not found' }, 404)
  } catch (err) { const message = err instanceof Error ? err.message : String(err); const cors = corsHeaders(request.headers.get('Origin')); return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }) }
} }