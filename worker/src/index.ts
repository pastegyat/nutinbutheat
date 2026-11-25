export interface Env {
  ASSETS: Fetcher
  POST_IMAGES: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
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
  R2_PREVIEW_BASE_URL?: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_ACCOUNT_ID: string
  R2_BUCKET_NAME: string
  ADMIN_EMAIL: string
  ADMIN_PASSWORD: string
  ADMIN_TOKEN_SECRET: string
  IP_HASH_SECRET: string
}

import { getSupabase } from './lib/supabase'

const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://nutinbutheat.com', 'https://www.nutinbutheat.com']
function corsHeaders(origin: string | null) { const o = origin ?? ''; const allow = ALLOWED_ORIGINS.includes(o) || o.endsWith('.vercel.app') ? o : ALLOWED_ORIGINS[0]; return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS', 'Vary': 'Origin' } }
const sanitizeSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
// Link-preview derivative base (og:image). Falls back to the single public base:
// https://images.nutinbutheat.com (per project decision — no separate preview domain).
const previewBase = (env: Env) => (env.R2_PREVIEW_BASE_URL || '').trim() || env.R2_PUBLIC_BASE_URL
function r2KeyFromUrl(env: Env, url: string): string | null {
  for (const base of [env.R2_PUBLIC_BASE_URL, (env.R2_PREVIEW_BASE_URL || '').trim()]) {
    if (!base) continue
    const prefix = `${base}/`
    if (url.startsWith(prefix)) return url.slice(prefix.length)
  }
  return null
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
const hexBytes = (b: Uint8Array) => [...b].map(v => v.toString(16).padStart(2, '0')).join('')
async function hmacBytes(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> { const key = await crypto.subtle.importKey('raw', keyBytes as unknown as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', key, data as unknown as ArrayBuffer)) }
// SigV4 presigned PUT straight to R2 — browser uploads bypass the Worker entirely,
// so multi-hundred-MB files are not subject to Worker body/memory limits.
async function presignedR2PutUrl(env: Env, key: string, expiresIn = 600): Promise<string> {
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const encodedPath = `/${env.R2_BUCKET_NAME}/${key.split('/').map(encodeURIComponent).join('/')}`
  const now = new Date()
  const stamp = (n: number, l = 2) => String(n).padStart(l, '0')
  const dateStamp = `${now.getUTCFullYear()}${stamp(now.getUTCMonth() + 1)}${stamp(now.getUTCDate())}`
  const amzDate = `${dateStamp}T${stamp(now.getUTCHours())}${stamp(now.getUTCMinutes())}${stamp(now.getUTCSeconds())}Z`
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const params: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${env.R2_ACCESS_KEY_ID}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresIn)],
    ['X-Amz-SignedHeaders', 'host;x-amz-content-sha256'],
  ]
  const canonicalQuery = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const canonicalRequest = ['PUT', encodedPath, canonicalQuery, `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\n`, 'host;x-amz-content-sha256', 'UNSIGNED-PAYLOAD'].join('\n')
  const hashHex = async (s: string) => hexBytes(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await hashHex(canonicalRequest)].join('\n')
  const enc = new TextEncoder()
  let signingKey = await hmacBytes(enc.encode(`AWS4${env.R2_SECRET_ACCESS_KEY}`), enc.encode(dateStamp))
  signingKey = await hmacBytes(signingKey, enc.encode('auto'))
  signingKey = await hmacBytes(signingKey, enc.encode('s3'))
  signingKey = await hmacBytes(signingKey, enc.encode('aws4_request'))
  const signature = hexBytes(await hmacBytes(signingKey, enc.encode(stringToSign)))
  return `https://${host}${encodedPath}?${canonicalQuery}&X-Amz-Signature=${signature}`
}
function sanitizeFilename(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) }

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const inflight = new Map<string, Promise<Response>>()
const evRates = new Map<string, { n: number; t: number }>()
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|python-requests|curl\/|wget|headless/i
async function invalidatePostCaches(...slugs: string[]) {
  const keys = new Set(['https://cache.local/posts/all'])
  for (const slug of slugs) if (slug) keys.add(`https://cache.local/posts/${encodeURIComponent(slug)}`)
  const cache = caches.default
  await Promise.all([...keys].flatMap(key => [cache.delete(new Request(key)), cache.delete(new Request(`${key}:stale`))]))
}
async function cachedJson(ctx: ExecutionContext | undefined, cacheKey: string, ttl: number, build: () => Promise<Response>, cors?: Record<string, string>): Promise<Response> {
  const cache = caches.default
  const req = new Request(cacheKey)
  const applyCors = (r: Response) => {
    if (cors) {
      for (const [k, v] of Object.entries(cors)) r.headers.set(k, v)
      r.headers.set('Vary', 'Origin')
    }
    return r
  }
  const hit = await cache.match(req)
  if (hit) { const r = new Response(hit.body, hit); r.headers.set('X-Cache', 'HIT'); return applyCors(r) }
  const existing = inflight.get(cacheKey)
  if (existing) { const r = await existing; const out = new Response(r.body, r); out.headers.set('X-Cache', 'COALESCED'); return applyCors(out) }
  const p = (async () => {
    let fresh: Response
    try { fresh = await build() }
    catch {
      const stale = await cache.match(req.url + ':stale')
      if (stale) { const r = new Response(stale.body, stale); r.headers.set('X-Cache', 'STALE'); return applyCors(r) }
      throw new Error('upstream failed')
    }
    const ok = new Response(fresh.body, fresh)
    ok.headers.set('X-Cache', 'MISS')
    ok.headers.set('Cache-Control', `public, max-age=${ttl}`)
    if (cors) { for (const [k, v] of Object.entries(cors)) ok.headers.set(k, v); ok.headers.set('Vary', 'Origin') }
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

// Supabase/PostgREST silently caps every response at 1000 rows (max-rows default),
// regardless of .limit(). Page through with .range() until a short page comes back.
// Pagination requires a deterministic order, so default to the primary key.
const SB_PAGE = 1000
const SB_MAX_PAGES = 50
async function fetchAllRows(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  select: string,
  opts?: {
    filters?: (q: any) => any
    orders?: Array<[string, boolean?]>
  },
): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const rows: Array<Record<string, unknown>> = []
  const orders: Array<[string, boolean?]> = opts?.orders ?? [['id', true]]
  for (let p = 0; p < SB_MAX_PAGES; p++) {
    let q: any = supabase.from(table).select(select)
    if (opts?.filters) q = opts.filters(q)
    for (const [col, asc] of orders) q = q.order(col, { ascending: asc ?? true })
    const from = p * SB_PAGE
    const { data, error } = await q.range(from, from + SB_PAGE - 1)
    if (error) return { data: null, error }
    const chunk = ((data as Array<Record<string, unknown>>) ?? [])
    rows.push(...chunk)
    if (chunk.length < SB_PAGE) return { data: rows, error: null }
  }
  return { data: rows, error: null }
}

function replaceMeta(html: string, key: string, value: string) {
  const attr = key.startsWith('twitter') ? 'name' : 'property'
  const re = new RegExp(`(<meta[^>]*${attr}="${key}"[^>]*content=")[^"]*(")`, 'i')
  if (re.test(html)) return html.replace(re, `$1${escHtml(value)}$2`)
  return html.replace('</head>', `<meta ${attr}="${key}" content="${escHtml(value)}" /></head>`)
}
async function buildCrawlerHtml(request: Request, url: URL, env: Env): Promise<string | null> {
  const supabase = getSupabase(env as unknown as { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string })
  const path = url.pathname.replace(/^\/+|\/+$/g, '')
  let title: string; let description: string; let image: string; let canonical: string
  let isPost = false; let publishedTime = ''; let section = ''
  if (path.startsWith('a/')) {
    const slug = decodeURIComponent(path.slice(2))
    if (!slug) return null
    const { data: album } = await supabase.from('albums').select('*').eq('slug', slug).maybeSingle()
    if (!album) return null
    title = String((album as Record<string, unknown>).title ?? '')
    description = String((album as Record<string, unknown>).description ?? '').slice(0, 160)
    // Album preview: use album thumbnail (project decision — no separate preview derivative).
    image = String((album as Record<string, unknown>).thumbnail ?? '')
    canonical = `https://nutinbutheat.com/a/${slug}`
  } else if (path && !['albums', 'trending', 'about', 'privacy', 'terms', 'contact', 'categories', 'nadmin'].includes(path)) {
    const slug = decodeURIComponent(path)
    const { data: post } = await supabase.from('posts').select('*').eq('slug', slug).maybeSingle()
    // Unlisted model: shared private links unfurl with their own meta too.
    if (!post) {
      // Text-paste fallback (pastes are excluded from the sitemap but unfurl when shared).
      const { data: paste } = await supabase.from('pastes').select('slug, title, content').eq('slug', slug).maybeSingle()
      if (!paste) return null
      const prow = paste as Record<string, unknown>
      title = String(prow.title ?? '') || 'Paste'
      description = String(prow.content ?? '').slice(0, 160)
      image = ''
      canonical = `https://nutinbutheat.com/${slug}`
    } else {
      const row = post as Record<string, unknown>
      title = String(row.title ?? '')
      description = String(row.description ?? '').slice(0, 160)
      image = String(row.preview_image_url ?? '').trim() || String(row.image_url ?? '')
      canonical = `https://nutinbutheat.com/${slug}`
      isPost = true
      publishedTime = String(row.created_at ?? '')
      section = String(row.category ?? '')
    }
  } else {
    return null
  }
  if (!title) return null
  if (!image) image = 'https://images.nutinbutheat.com/posts/logo-og.jpg'
  if (image && !image.startsWith('http')) image = `https://nutinbutheat.com${image.startsWith('/') ? '' : '/'}${image}`
  const pageRes = await (env as Env & { ASSETS: Fetcher }).ASSETS.fetch(new Request('https://assets.local/'))
  let html = await pageRes.text()
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escHtml(title)} - NutinButHeat</title>`)
  html = replaceMeta(html, 'og:type', 'article')
  html = replaceMeta(html, 'og:title', title)
  html = replaceMeta(html, 'og:description', description)
  html = replaceMeta(html, 'og:image', image)
  html = replaceMeta(html, 'og:image:width', '1200')
  html = replaceMeta(html, 'og:image:height', '630')
  html = replaceMeta(html, 'og:url', canonical)
  html = replaceMeta(html, 'twitter:card', 'summary_large_image')
  html = replaceMeta(html, 'twitter:url', canonical)
  html = replaceMeta(html, 'twitter:title', title)
  html = replaceMeta(html, 'twitter:description', description)
  html = replaceMeta(html, 'twitter:image', image)
  html = replaceMeta(html, 'og:image:alt', title)
  html = replaceMeta(html, 'twitter:image:alt', title)
  if (isPost) {
    if (section) html = replaceMeta(html, 'article:section', section)
    if (publishedTime) html = replaceMeta(html, 'article:published_time', publishedTime)
  }
  return html
}

function toAppwriteDoc(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, $id: row.id, $createdAt: row.created_at, $updatedAt: row.created_at }
}

export default { async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
  const cors = corsHeaders(request.headers.get('Origin'))
  // BigInt-safe JSON: PostgreSQL count(*) returns bigint, which JSON.stringify can't serialize.
  const toJson = (v: unknown): string => JSON.stringify(v, (_k, val) => typeof val === 'bigint' ? Number(val) : val)
  const json = (body: unknown, status = 200, noCache = false) => new Response(toJson(body), { status, headers: { ...cors, 'Content-Type': 'application/json', ...(noCache ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } : {}) } })
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
  const url = new URL(request.url)
  if (request.method === 'POST' && url.pathname === '/track') {
    if (BOT_RE.test(request.headers.get('User-Agent') ?? '')) return json({ ok: true, skipped: true })
    const body = await request.json() as { path?: string; search?: string; id?: string; duration_ms?: number }
    const supabase = getSupabase(env)
    if (typeof body.id === 'string' && body.id) {
      // Finalize: accumulate on-page time into the pageviews lifetime + daily rows.
      if (typeof body.duration_ms === 'number') {
        const ms = Math.max(0, Math.round(body.duration_ms))
        const { error } = await supabase.rpc('add_pageview_duration', { p_id: body.id, p_ms: ms })
        if (error) return json({ error: 'Could not finalize pageview.' }, 502)
      }
      return json({ ok: true })
    }
    const cleanPath = typeof body.path === 'string' ? body.path.trim().slice(0, 200) : ''; if (!cleanPath.startsWith('/')) return json({ error: 'Invalid path.' }, 400)
    // Simple +1 per visit: atomic upsert of the lifetime row + today's bucket.
    // The search field is accepted but ignored (Top Searches retired).
    const { data, error } = await supabase.rpc('record_pageview', { p_path: cleanPath })
    if (error) return json({ error: 'Could not record pageview.' }, 502)
    return json({ ok: true, id: data as string })
  }
  if (request.method === 'GET' && url.pathname === '/reactions/all') {
    // No cache: reaction counts must be real-time (a like should show immediately after refresh).
    const supabase = getSupabase(env)
    const { data: docs, error } = await fetchAllRows(supabase, 'reactions', 'post_id, type')
    if (error) return json({ error: `Could not load reactions: ${error.message}` }, 502)
    const map: Record<string, { likes: number; dislikes: number }> = {}
    for (const d of (docs as Array<Record<string, unknown>>) ?? []) {
      const pid = String(d.post_id ?? ''); if (!pid) continue
      map[pid] ??= { likes: 0, dislikes: 0 }
      const t = String(d.type ?? '')
      if (t === 'like') map[pid].likes += 1; else if (t === 'dislike') map[pid].dislikes += 1
    }
    return json(map, 200, true)
  }
  if (request.method === 'GET' && url.pathname === '/posts/all') {
    return cachedJson(ctx, 'https://cache.local/posts/all', 600, async () => {
      const supabase = getSupabase(env)
      const { data: posts, error } = await fetchAllRows(supabase, 'posts', '*', { filters: q => q.eq('status', 'public'), orders: [['created_at', false], ['id', true]] })
      if (error) throw new Error(error.message)
      const trimmed = (posts as Array<Record<string, unknown>>).map(p => ({ $id: String(p.id ?? ''), title: String(p.title ?? ''), slug: String(p.slug ?? ''), description: String(p.description ?? ''), image_url: String(p.image_url ?? ''), preview_image_url: String(p.preview_image_url ?? ''), category: String(p.category ?? ''), is_premium: p.is_premium ?? 'no', status: String(p.status ?? 'public'), views: Number(p.views ?? 0) || 0, link_clicks: Number(p.link_clicks ?? 0) || 0, created_at: String(p.created_at ?? '') }))
      return new Response(JSON.stringify({ posts: trimmed }), { headers: { ...corsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' } })
    }, cors)
  }
  if (request.method === 'GET' && url.pathname.startsWith('/posts/')) {
    const slug = decodeURIComponent(url.pathname.slice('/posts/'.length))
    if (!slug) return json({ error: 'Missing slug.' }, 400)
    return cachedJson(ctx, `https://cache.local/posts/${encodeURIComponent(slug)}`, 600, async () => {
      const supabase = getSupabase(env)
      // Unlisted model: exact-slug lookup serves public AND private posts.
      // Listing (/posts/all), sitemap and search sources stay public-only.
      const { data: post, error } = await supabase.from('posts').select('*').eq('slug', slug).maybeSingle()
      if (error) throw new Error(error.message)
      return post ? json(toAppwriteDoc(post as Record<string, unknown>)) : json({ error: 'Post not found.' }, 404)
    }, cors)
  }
  // NOTE: browsers navigating to the /albums *page* send Accept: text/html while
  // API clients (fetch) send */* — only serve JSON to the latter so direct
  // visits/refreshes/shares of the page render the SPA instead of raw JSON.
  if (request.method === 'GET' && url.pathname === '/albums' && !(request.headers.get('Accept') ?? '').includes('text/html')) {
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const q = (url.searchParams.get('q') ?? '').trim()
    return cachedJson(ctx, `https://cache.local/albums?p=${page}&per=${per}&q=${encodeURIComponent(q)}`, 120, async () => {
    try {
      let total = 0; let pageAlbums: Array<Record<string, unknown>> = []
      const supabase = getSupabase(env)
      const isPremium = (v: unknown) => v === 'yes' || v === true || v === 1 || String(v).toLowerCase() === 'yes' || String(v) === '1'
      const { data: all, error } = await fetchAllRows(supabase, 'albums', '*', { orders: [['created_at', false], ['id', true]] })
      if (error) throw new Error(error.message)
      let filtered = ((all as Array<Record<string, unknown>>) ?? []).filter(a => !isPremium(a.is_premium))
      if (q) {
        const low = q.toLowerCase()
        filtered = filtered.filter(a => String(a.title ?? '').toLowerCase().includes(low) || String(a.description ?? '').toLowerCase().includes(low))
      }
      total = filtered.length; const off = (page - 1) * per; pageAlbums = filtered.slice(off, off + per)
      const ids = pageAlbums.map(a => String(a.id ?? ''))
      let allItems: Array<Record<string, unknown>> = []
      if (ids.length) {
        const { data: items } = await fetchAllRows(supabase, 'album_items', '*', { filters: q => q.in('album_id', ids) })
        allItems = (items as Array<Record<string, unknown>>) ?? []
      }
      const enriched = pageAlbums.map(a => {
        const aid = String(a.id ?? ''); const thumb: string = String(a.thumbnail ?? '')
        const related = allItems.filter(it => String(it.album_id ?? '') === aid)
        const item_count = related.length; const video_count = related.filter(it => String(it.type ?? '') === 'video').length; const image_count = related.filter(it => String(it.type ?? '') === 'image').length
        let cover = thumb; if (!cover) { related.sort((x, y) => { const sx = Number(x.sort_order ?? 0); const sy = Number(y.sort_order ?? 0); if (sx !== sy) return sx - sy; return String(x.id ?? '').localeCompare(String(y.id ?? '')) }); const first = related.find(it => String(it.thumbnail ?? '').trim() !== ''); if (first) cover = String(first.thumbnail ?? '') }
        return { ...toAppwriteDoc(a), item_count, video_count, image_count, cover }
      })
      return json({ total, page, per, albums: enriched, q })
    } catch (e) { if (String(e).includes('404') || String(e).includes('not found')) return json({ total: 0, page, per, albums: [] }) ; throw e }
    }, cors)
  }
  if (request.method === 'GET' && url.pathname.startsWith('/albums/')) {
    const slug = decodeURIComponent(url.pathname.slice('/albums/'.length).replace(/^\/+|\/+$/g, ''))
    if (!slug) return json({ error: 'Missing slug.' }, 400)
    const supabase = getSupabase(env)
    const { data: album } = await supabase.from('albums').select('*').eq('slug', slug).maybeSingle()
    if (!album) return json({ error: 'Album not found.' }, 404)
    const ua = request.headers.get('User-Agent') ?? ''; if (!/bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview/i.test(ua)) {
      // Simple +1 (non-unique) per visit — atomic, no read-modify-write races.
      const albumId = String((album as Record<string, unknown>).id ?? '')
      ctx.waitUntil(supabase.rpc('increment_album_view', { p_album_id: albumId }).then(() => {}).catch(() => {}))
    }
    const { data: items } = await fetchAllRows(supabase, 'album_items', '*', { filters: q => q.eq('album_id', String((album as Record<string, unknown>).id ?? '')), orders: [['sort_order', true], ['id', true]] })
    const sorted = ((items as Array<Record<string, unknown>>) ?? []).slice().sort((a, b) => { const sa = Number(a.sort_order ?? 0); const sb = Number(b.sort_order ?? 0); if (sa !== sb) return sa - sb; return String(a.id ?? '').localeCompare(String(b.id ?? '')) })
    return json({ album: toAppwriteDoc(album as Record<string, unknown>), items: sorted.map(toAppwriteDoc) })
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
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) return json({ error: 'R2 upload credentials not configured.' }, 500)
    // Direct-to-R2 presigned PUT: the browser uploads straight to R2, so files
    // of any size (up to R2's 5 GB single-PUT limit) never pass through the Worker.
    const uploadUrl = await presignedR2PutUrl(env, key, 600)
    return json({ uploadUrl, publicUrl, key })
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
    const supabase = getSupabase(env)
    const { data, error } = await supabase.from('albums').insert({ id: crypto.randomUUID(), title, slug, description, thumbnail, is_premium, view_count: 0, created_at: new Date().toISOString() }).select('*').maybeSingle()
    if (error) return json({ error: `Album create failed: ${error.message}` }, 502)
    return json(toAppwriteDoc(data as Record<string, unknown>), 201)
  }
  if (request.method === 'GET' && url.pathname === '/admin/albums') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const supabase = getSupabase(env)
    const { data: albums, error, count } = await supabase.from('albums').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * per, page * per - 1)
    if (error) return json({ error: `Albums read failed: ${error.message}` }, 502)
    const ids = (albums as Array<Record<string, unknown>>).map(a => String(a.id ?? ''))
    let allItems: Array<Record<string, unknown>> = []
    if (ids.length) {
      const { data: items } = await fetchAllRows(supabase, 'album_items', '*', { filters: q => q.in('album_id', ids) })
      allItems = (items as Array<Record<string, unknown>>) ?? []
    }
    const enriched = (albums as Array<Record<string, unknown>>).map(a => {
      const aid = String(a.id ?? ''); const related = allItems.filter(it => String(it.album_id ?? '') === aid)
      return { ...toAppwriteDoc(a), item_count: related.length }
    })
    return json({ total: count ?? enriched.length, page, per, albums: enriched })
  }
  if (request.method === 'POST' && url.pathname.startsWith('/admin/albums/') && url.pathname.endsWith('/items')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const parts = url.pathname.split('/').filter(Boolean); const albumId = parts[2] ?? ''
    const supabase = getSupabase(env)
    const { data: album } = await supabase.from('albums').select('*').eq('id', albumId).maybeSingle(); if (!album) return json({ error: 'Album not found.' }, 404)
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
    const { data: existingRows } = await fetchAllRows(supabase, 'album_items', '*', { filters: q => q.eq('album_id', albumId) })
    const existing = (existingRows as Array<Record<string, unknown>>) ?? []
    let nextOrder = 1; if (existing.length) nextOrder = Math.max(...existing.map(d => Number((d as Record<string, unknown>).sort_order ?? 0))) + 1
    for (const it of items) {
      const { error } = await supabase.from('album_items').insert({ id: crypto.randomUUID(), album_id: albumId, type: it.type === 'image' ? 'image' : 'video', title: it.title, r2_url: it.r2_url, thumbnail: it.thumbnail, sort_order: nextOrder++, created_at: new Date().toISOString() })
      if (error) return json({ error: `Item save failed: ${error.message}` }, 502)
    }
    if (!String((album as Record<string, unknown>).thumbnail ?? '').trim()) {
      const firstWithThumb = items.find(it => it.thumbnail.trim() !== '')
      if (firstWithThumb) await supabase.from('albums').update({ thumbnail: firstWithThumb.thumbnail }).eq('id', albumId)
      else {
        const firstItemWithThumb = existing.find(d => String((d as Record<string, unknown>).thumbnail ?? '').trim() !== '')
        if (firstItemWithThumb) await supabase.from('albums').update({ thumbnail: String((firstItemWithThumb as Record<string, unknown>).thumbnail ?? '') }).eq('id', albumId)
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
      const supabase = getSupabase(env)
      const { data: item } = await supabase.from('album_items').select('*').eq('id', itemId).maybeSingle() as { data: Record<string, unknown> | null }; if (!item) return json({ error: 'Item not found.' }, 404)
      if (String(item.album_id ?? '') !== albumId) return json({ error: 'Item does not belong to this album.' }, 400)
      const { error } = await supabase.from('album_items').delete().eq('id', itemId)
      if (error) return json({ error: `Delete item failed: ${error.message}` }, 502)
      return json({ ok: true })
    }
    if (parts.length === 3) {
      const albumId = parts[2] ?? ''
      const supabase = getSupabase(env)
      const { data: album } = await supabase.from('albums').select('*').eq('id', albumId).maybeSingle(); if (!album) return json({ error: 'Album not found.' }, 404)
      const thumbUrl = String((album as Record<string, unknown>).thumbnail ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (thumbUrl.startsWith(prefix)) { const k = thumbUrl.slice(prefix.length); if (k.startsWith('album-')) await env.POST_IMAGES.delete(k).catch(() => {}) }
      const { data: itemsRows } = await fetchAllRows(supabase, 'album_items', '*', { filters: q => q.eq('album_id', albumId) })
      const items = (itemsRows as Array<Record<string, unknown>>) ?? []
      for (const it of items) {
        const r2 = String((it as Record<string, unknown>).r2_url ?? ''); if (r2.startsWith(prefix)) { const k = r2.slice(prefix.length); if (k.startsWith('album-')) await env.POST_IMAGES.delete(k).catch(() => {}) }
        const th = String((it as Record<string, unknown>).thumbnail ?? ''); if (th.startsWith(prefix)) { const k = th.slice(prefix.length); if (k.startsWith('album-')) await env.POST_IMAGES.delete(k).catch(() => {}) }
        const iid = String((it as Record<string, unknown>).id ?? (it as Record<string, unknown>).$id ?? ''); if (iid) await supabase.from('album_items').delete().eq('id', iid)
      }
      const { error } = await supabase.from('albums').delete().eq('id', albumId)
      if (error) return json({ error: `Delete album failed: ${error.message}` }, 502)
      return json({ ok: true })
    }
    return json({ error: 'Not found' }, 404)
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/robots.txt') {
    return new Response('User-agent: *\nAllow: /\nDisallow: /nadmin\n\nUser-agent: GPTBot\nAllow: /\nDisallow: /nadmin\n\nUser-agent: CCBot\nAllow: /\nDisallow: /nadmin\n\nSitemap: https://nutinbutheat.com/sitemap.xml\n', { headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Cache-Control': 'public, max-age=3600' } })
  }
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/sitemap.xml') {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const today = new Date().toISOString().slice(0, 10)
    const staticPaths = ['', '/trending', '/albums', '/categories', '/about', '/terms', '/privacy', '/contact']
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for (const p of staticPaths) xml += `  <url><loc>https://nutinbutheat.com${esc(p)}</loc><lastmod>${today}</lastmod><changefreq>${p === '' ? 'hourly' : 'weekly'}</changefreq><priority>${p === '' ? '1.0' : '0.7'}</priority></url>\n`
    try {
      const supabase = getSupabase(env)
      const { data: posts, error: postsError } = await fetchAllRows(supabase, 'posts', 'slug, created_at', { filters: q => q.eq('status', 'public'), orders: [['created_at', false], ['id', true]] })
      if (postsError) xml += `<!-- posts error: ${escHtml(postsError.message)} -->`
      for (const p of (posts as Array<Record<string, unknown>>) ?? []) {
        const slug = String(p.slug ?? ''); if (!slug) continue
        const lastmod = String(p.created_at ?? '').slice(0, 10) || today
        xml += `  <url><loc>https://nutinbutheat.com/${encodeURIComponent(slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`
      }
    } catch (e) { xml += `<!-- posts catch: ${escHtml(String(e))} -->` }
    try {
      const supabase = getSupabase(env)
      const { data: albums, error: albumsError } = await fetchAllRows(supabase, 'albums', 'slug, created_at, is_premium', { orders: [['created_at', false], ['id', true]] })
      if (albumsError) xml += `<!-- albums error: ${escHtml(albumsError.message)} -->`
      const isPremium = (v: unknown) => v === 'yes' || v === true || v === 1 || String(v).toLowerCase() === 'yes' || String(v) === '1'
      for (const a of (albums as Array<Record<string, unknown>>) ?? []) {
        if (isPremium(a.is_premium)) continue
        const slug = String(a.slug ?? ''); if (!slug) continue
        const lastmod = String(a.created_at ?? '').slice(0, 10) || today
        xml += `  <url><loc>https://nutinbutheat.com/a/${encodeURIComponent(slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>\n`
      }
    } catch (e) { xml += `<!-- albums catch: ${escHtml(String(e))} -->` }
    xml += '</urlset>'
    return new Response(xml, { headers: { 'Content-Type': 'application/xml;charset=UTF-8', 'Cache-Control': 'public, max-age=3600' } })
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    const isAssetFile = /\.(js|css|png|jpe?g|webp|gif|svg|ico|txt|json|xml|woff2?|ttf|mp4|webm)$/i.test(url.pathname)
    const accept = request.headers.get('Accept') ?? ''
    const ua = request.headers.get('User-Agent') ?? ''
    const isCrawler = /facebookexternalhit|twitterbot|telegrambot|whatsapp|discordbot|slackbot|linkedinbot|embedly|quora link preview|vkshare|preview/i.test(ua)
    // Crawlers get server-rendered meta HTML regardless of Accept header —
    // validators often send Accept: */* and otherwise land on JSON 404s.
    if (!isAssetFile && isCrawler) {
      try {
        const html = await buildCrawlerHtml(request, url, env)
        if (html) return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300', 'Vary': 'User-Agent' } })
      } catch { /* fall through to assets */ }
    }
    if (!isAssetFile && accept.includes('text/html')) {
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
    const supabase = getSupabase(env)
    try {
      const { count, error: countErr } = await supabase.from('contact_messages').select('*', { count: 'exact', head: true }).eq('ip_address', ip).gte('created_at', tenMinAgo)
      if (!countErr && (count ?? 0) >= 3) return json({ error: 'Too many messages. Please wait a few minutes.' }, 429)
    } catch { /* ignore for count */ }
    const { error } = await supabase.from('contact_messages').insert({ id: crypto.randomUUID(), name, email, reason, message, ip_address: ip, created_at: new Date().toISOString() })
    if (error) return json({ error: 'Could not save message.' }, 502)
    return json({ ok: true })
  }
  if (request.method === 'GET' && url.pathname === '/admin/contact') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const supabase = getSupabase(env)
    const { data, error, count } = await supabase.from('contact_messages').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * per, page * per - 1)
    if (error) return json({ error: `Contact read failed: ${error.message}` }, 502)
    return json({ total: count ?? (data as Array<unknown>)?.length ?? 0, page, per, messages: data ?? [] })
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/admin/contact/')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const id = url.pathname.split('/').filter(Boolean).pop() ?? ''
    if (!id) return json({ error: 'Missing id.' }, 400)
    const supabase = getSupabase(env)
    const { error } = await supabase.from('contact_messages').delete().eq('id', id)
    if (error) return json({ error: `Delete failed: ${error.message}` }, 502)
    return json({ ok: true })
  }
  if (request.method === 'POST' && url.pathname === '/reports') {
    if (BOT_RE.test(request.headers.get('User-Agent') ?? '')) return json({ ok: true, skipped: true })
    const { postId, reason } = await request.json() as { postId?: string; reason?: string }
    const cleanReason = String(reason ?? '').trim().slice(0, 2000)
    if (!postId || !cleanReason) return json({ error: 'Post and reason are required.' }, 400)
    const repIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const nowT = Date.now(); const rec = evRates.get(repIp) ?? { n: 0, t: nowT }; if (nowT - rec.t > 60000) { rec.n = 0; rec.t = nowT }; rec.n++; evRates.set(repIp, rec)
    if (rec.n > 10) return json({ ok: true, limited: true })
    const supabase = getSupabase(env)
    const { data: reported } = await supabase.from('posts').select('id, slug, title').eq('id', postId).maybeSingle()
    if (!reported) return json({ error: 'Post not found.' }, 404)
    const row = reported as Record<string, unknown>
    const { error } = await supabase.from('reports').insert({ id: crypto.randomUUID(), post_id: String(row.id ?? postId), post_slug: String(row.slug ?? ''), post_title: String(row.title ?? ''), reason: cleanReason, ip_address: repIp, created_at: new Date().toISOString() })
    if (error) return json({ error: 'Could not submit report.' }, 502)
    return json({ ok: true })
  }
  if (request.method === 'GET' && url.pathname === '/admin/reports') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const supabase = getSupabase(env)
    const { data, error, count } = await supabase.from('reports').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * per, page * per - 1)
    if (error) return json({ error: `Reports read failed: ${error.message}` }, 502)
    return json({ total: count ?? (data as Array<unknown>)?.length ?? 0, page, per, reports: data ?? [] })
  }
  if (request.method === 'POST' && url.pathname === '/admin/pastes') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const body = await request.json() as { title?: string; content?: string }
    const title = String(body.title ?? '').trim().slice(0, 200) || 'Untitled'
    const content = String(body.content ?? '').trim().slice(0, 20000)
    if (!content) return json({ error: 'Content is required.' }, 400)
    const supabase = getSupabase(env)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const randSlug = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    for (let attempt = 0; attempt < 10; attempt++) {
      const slug = randSlug()
      const { data, error } = await supabase.from('pastes').insert({ id: crypto.randomUUID(), slug, title, content, views: 0, created_at: new Date().toISOString() }).select('slug, title, content, created_at').maybeSingle()
      if (!error && data) return json({ ...(data as Record<string, unknown>), url: `https://nutinbutheat.com/${slug}` }, 201)
      if (error && !String(error.message).includes('duplicate') && !String(error.message).includes('unique')) return json({ error: `Paste create failed: ${error.message.slice(0, 200)}` }, 502)
    }
    return json({ error: 'Could not generate a unique slug, try again.' }, 503)
  }
  if (request.method === 'GET' && url.pathname === '/admin/pastes') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const supabase = getSupabase(env)
    const { data, error, count } = await supabase.from('pastes').select('id, slug, title, views, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * per, page * per - 1)
    if (error) return json({ error: `Pastes read failed: ${error.message}` }, 502)
    return json({ total: count ?? (data as Array<unknown>)?.length ?? 0, page, per, pastes: (data as Array<Record<string, unknown>> ?? []).map(p => ({ ...p, url: `https://nutinbutheat.com/${String(p.slug ?? '')}` })) })
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/admin/pastes/')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const id = url.pathname.split('/').filter(Boolean).pop() ?? ''
    if (!id) return json({ error: 'Missing id.' }, 400)
    const supabase = getSupabase(env)
    const { error } = await supabase.from('pastes').delete().eq('id', id)
    if (error) return json({ error: `Delete failed: ${error.message}` }, 502)
    return json({ ok: true })
  }
  if (request.method === 'GET' && url.pathname.startsWith('/pastes/')) {
    const slug = decodeURIComponent(url.pathname.slice('/pastes/'.length).replace(/^\/+|\/+$/g, ''))
    if (!slug) return json({ error: 'Missing slug.' }, 400)
    const supabase = getSupabase(env)
    const { data: paste, error } = await supabase.from('pastes').select('slug, title, content, created_at').eq('slug', slug).maybeSingle()
    if (error) return json({ error: `Paste read failed: ${error.message.slice(0, 200)}` }, 502)
    if (!paste) return json({ error: 'Paste not found.' }, 404)
    // Views counted server-side but never exposed: response carries no views field.
    if (!BOT_RE.test(request.headers.get('User-Agent') ?? '')) ctx.waitUntil(supabase.rpc('increment_paste_view', { p_slug: slug }).then(() => {}).catch(() => {}))
    return json(paste)
  }
  if (request.method === 'POST' && url.pathname === '/admin/import-posts') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const body = await request.json() as { wipe?: boolean; posts?: Array<Record<string, unknown>> }
    const list = Array.isArray(body.posts) ? body.posts : []
    let wiped = 0
    const supabase = getSupabase(env)
    if (body.wipe) {
      const { data: existing } = await fetchAllRows(supabase, 'posts', 'id, image_url')
      const docs = (existing as Array<Record<string, unknown>>) ?? []
      for (const doc of docs) {
        const img = String((doc as Record<string, unknown>).image_url ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (img.startsWith(prefix)) { const k = img.slice(prefix.length); if (k.startsWith('posts/')) await env.POST_IMAGES.delete(k).catch(() => {}) }
      }
      if (docs.length) {
        // delete where true: use neq with impossible id
        const { error } = await supabase.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (!error) wiped = docs.length
      }
    }
    let created = 0; const errors: string[] = []
    const toInsert: Array<Record<string, unknown>> = []
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
      const preview_image_url = String((p as Record<string, unknown>).preview_image_url ?? '').trim()
      toInsert.push({ id: crypto.randomUUID(), title, slug, description, image_url, preview_image_url, category, is_premium, status, views, link_clicks, created_at })
    }
    if (toInsert.length) {
      let rows = toInsert
      let res = await supabase.from('posts').insert(rows).select('id')
      if (res.error && String(res.error.message).includes('preview_image_url')) {
        rows = toInsert.map(({ preview_image_url: _omit, ...rest }) => rest)
        res = await supabase.from('posts').insert(rows).select('id')
      }
      const { data, error } = res
      if (error) {
        // fallback to per-row to collect granular errors
        for (const row of rows) {
          let rErr: { message: string } | null = null
          const insRow = await supabase.from('posts').insert(row)
          rErr = insRow.error as { message: string } | null
          if (rErr && String(rErr.message).includes('preview_image_url')) {
            const { preview_image_url: _omit2, ...rest2 } = row
            const retry = await supabase.from('posts').insert(rest2)
            rErr = retry.error as { message: string } | null
          }
          if (!rErr) created++; else errors.push(`fail ${String(row.slug)}: ${String(rErr.message).slice(0,200)}`)
        }
      } else {
        created = (data as Array<unknown>)?.length ?? rows.length
      }
    }
    await invalidatePostCaches()
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
    let preview_image_url = ''
    let previewKey = ''
    const preview = form.get('preview')
    if (preview instanceof File && preview.size > 0) {
      if (!preview.type.startsWith('image/') || preview.size > 1024 * 1024) { await env.POST_IMAGES.delete(key); return json({ error: 'Preview must be an image smaller than 1 MB.' }, 400) }
      previewKey = `posts/${slug}-${crypto.randomUUID()}-preview.jpg`
      await env.POST_IMAGES.put(previewKey, preview.stream(), { httpMetadata: { contentType: 'image/jpeg' } })
      preview_image_url = `${previewBase(env)}/${previewKey}`
    }
    const supabase = getSupabase(env)
    const newId = crypto.randomUUID()
    let ins = await supabase.from('posts').insert({ id: newId, title, slug, description: String(form.get('description') ?? ''), image_url: `${env.R2_PUBLIC_BASE_URL}/${key}`, preview_image_url, category: String(form.get('category') ?? ''), is_premium: String(form.get('is_premium') ?? 'no'), status: String(form.get('status') ?? 'public'), views: 0, link_clicks: 0, created_at: new Date().toISOString() }).select('*').maybeSingle()
    if (ins.error && String(ins.error.message).includes('preview_image_url')) {
      ins = await supabase.from('posts').insert({ id: newId, title, slug, description: String(form.get('description') ?? ''), image_url: `${env.R2_PUBLIC_BASE_URL}/${key}`, category: String(form.get('category') ?? ''), is_premium: String(form.get('is_premium') ?? 'no'), status: String(form.get('status') ?? 'public'), views: 0, link_clicks: 0, created_at: new Date().toISOString() }).select('*').maybeSingle() as typeof ins
    }
    const { data, error } = ins
    if (error || !data) { await env.POST_IMAGES.delete(key); if (previewKey) await env.POST_IMAGES.delete(previewKey).catch(() => {}); return json({ error: `Post creation failed: ${error?.message ?? 'unknown'}` }, 502) }
    await invalidatePostCaches(slug)
    return json(toAppwriteDoc(data as Record<string, unknown>), 201)
  }
  if (request.method === 'GET' && url.pathname === '/admin/posts') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const per = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per') ?? '20', 10) || 20))
    const supabase = getSupabase(env)
    const { data, error, count } = await supabase.from('posts').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * per, page * per - 1)
    if (error) return json({ error: `List read failed: ${error.message}` }, 502)
    const docs = ((data as Array<Record<string, unknown>>) ?? []).map(toAppwriteDoc)
    return json({ total: count ?? docs.length, page, per, posts: docs })
  }
  if (request.method === 'PATCH' && url.pathname.startsWith('/admin/posts/')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const id = url.pathname.split('/').filter(Boolean).pop() ?? ''
    const supabase = getSupabase(env)
    const { data: existing } = await supabase.from('posts').select('*').eq('id', id).maybeSingle(); if (!existing) return json({ error: 'Post not found.' }, 404)
    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim(); if (!title) return json({ error: 'Title is required.' }, 400)
    const slug = sanitizeSlug(String(form.get('slug') ?? '')); if (!slug) return json({ error: 'Slug is required.' }, 400)
    const { data: dupRows } = await supabase.from('posts').select('id').eq('slug', slug).neq('id', id).limit(1)
    if ((dupRows as Array<Record<string, unknown>>)?.length) return json({ error: 'That slug is already in use.' }, 400)
    const data: Record<string, unknown> = { title, slug, description: String(form.get('description') ?? ''), category: String(form.get('category') ?? ''), is_premium: String(form.get('is_premium') ?? 'no'), status: String(form.get('status') ?? 'private') }
    const image = form.get('image')
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith('image/') || image.size > 10 * 1024 * 1024) return json({ error: 'Use an image smaller than 10 MB.' }, 400)
      const key = `posts/${slug}-${crypto.randomUUID()}.${image.name.split('.').pop()?.toLowerCase() || 'webp'}`
      await env.POST_IMAGES.put(key, image.stream(), { httpMetadata: { contentType: image.type }, customMetadata: { originalName: image.name } })
      data.image_url = `${env.R2_PUBLIC_BASE_URL}/${key}`
      const oldUrl = String((existing as Record<string, unknown>).image_url ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (oldUrl.startsWith(prefix)) { const oldKey = oldUrl.slice(prefix.length); if (oldKey.startsWith('posts/')) await env.POST_IMAGES.delete(oldKey).catch(() => {}) }
    }
    const previewFile = form.get('preview')
    if (previewFile instanceof File && previewFile.size > 0) {
      if (!previewFile.type.startsWith('image/') || previewFile.size > 1024 * 1024) return json({ error: 'Preview must be an image smaller than 1 MB.' }, 400)
      const pkey = `posts/${slug}-${crypto.randomUUID()}-preview.jpg`
      await env.POST_IMAGES.put(pkey, previewFile.stream(), { httpMetadata: { contentType: 'image/jpeg' } })
      data.preview_image_url = `${previewBase(env)}/${pkey}`
      const oldPreviewKey = r2KeyFromUrl(env, String((existing as Record<string, unknown>).preview_image_url ?? '')); if (oldPreviewKey && oldPreviewKey.startsWith('posts/')) await env.POST_IMAGES.delete(oldPreviewKey).catch(() => {})
    }
    let upd = await supabase.from('posts').update(data).eq('id', id).select('*').maybeSingle()
    if (upd.error && String(upd.error.message).includes('preview_image_url')) {
      const fallback: Record<string, unknown> = { ...data }
      delete fallback.preview_image_url
      upd = await supabase.from('posts').update(fallback).eq('id', id).select('*').maybeSingle() as typeof upd
    }
    const { data: updated, error } = upd
    if (error || !updated) return json({ error: `Update failed: ${error?.message ?? 'unknown'}` }, 502)
    await invalidatePostCaches(String((existing as Record<string, unknown>).slug ?? ''), slug)
    return json(toAppwriteDoc(updated as Record<string, unknown>))
  }
  if (request.method === 'DELETE' && url.pathname.startsWith('/admin/posts/')) {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const id = url.pathname.split('/').filter(Boolean).pop() ?? ''
    const supabase = getSupabase(env)
    const { data: existing } = await supabase.from('posts').select('*').eq('id', id).maybeSingle(); if (!existing) return json({ error: 'Post not found.' }, 404)
    const oldUrl = String((existing as Record<string, unknown>).image_url ?? ''); const prefix = `${env.R2_PUBLIC_BASE_URL}/`; if (oldUrl.startsWith(prefix)) { const oldKey = oldUrl.slice(prefix.length); if (oldKey.startsWith('posts/')) await env.POST_IMAGES.delete(oldKey).catch(() => {}) }
    const oldPreviewKey = r2KeyFromUrl(env, String((existing as Record<string, unknown>).preview_image_url ?? '')); if (oldPreviewKey && oldPreviewKey.startsWith('posts/')) await env.POST_IMAGES.delete(oldPreviewKey).catch(() => {})
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) return json({ error: `Delete failed: ${error.message}` }, 502)
    await invalidatePostCaches(String((existing as Record<string, unknown>).slug ?? ''))
    await Promise.all([supabase.from('reactions').delete().eq('post_id', id), supabase.from('post_events').delete().eq('post_id', id)])
    return json({ ok: true })
  }
  if (request.method === 'POST' && url.pathname === '/admin/stats') {
    const admin = await isAdmin(request, env); if (!admin.ok) return json({ error: admin.reason ?? 'Unauthorized' }, 401)
    const supabase = getSupabase(env)
    const { data: postsData, error: postsErr } = await fetchAllRows(supabase, 'posts', 'title, slug, status, views, link_clicks, created_at', { orders: [['created_at', false], ['id', true]] })
    if (postsErr) throw new Error(`stats ${postsErr.message}`)
    const docs = ((postsData as Array<{ title: string; slug: string; status: string; views: number | null; link_clicks: number | null; created_at: string }>) ?? [])
    const topClicked = [...docs].sort((a, b) => (Number(b.link_clicks) || 0) - (Number(a.link_clicks) || 0)).slice(0, 8).map(({ title, link_clicks, slug }) => ({ title, link_clicks: Number(link_clicks) || 0, slug }))
    const totals = { posts: docs.length, publicCount: docs.filter(d => d.status === 'public').length, privateCount: docs.filter(d => d.status === 'private').length, postViews: docs.reduce((a, d) => a + (Number(d.views) || 0), 0), linkClicks: docs.reduce((a, d) => a + (Number(d.link_clicks) || 0), 0) }
    // Album views: lifetime +1 counters on albums.view_count.
    const { data: albumRows, error: albumErr } = await fetchAllRows(supabase, 'albums', 'title, slug, view_count, created_at', { orders: [['view_count', false], ['id', true]] })
    if (albumErr) throw new Error(`stats albums ${albumErr.message}`)
    const albumDocs = ((albumRows as Array<{ title: string; slug: string; view_count: number | null; created_at: string }>) ?? [])
    const albumViewsTotal = albumDocs.reduce((a, d) => a + (Number(d.view_count) || 0), 0)
    const recentAlbums = [...albumDocs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).map(({ title, slug, view_count, created_at }) => ({ title, slug, views: Number(view_count) || 0, created_at }))
    // Top Pages: lifetime counters straight from the pageviews table.
    const { data: pvRows, error: pvErr } = await supabase.from('pageviews').select('path, views, duration').order('views', { ascending: false }).limit(8)
    if (pvErr) throw new Error(pvErr.message)
    const topPages = ((pvRows as Array<{ path: string; views: number; duration: number }>) ?? []).map(r => ({ path: r.path, visits: Number(r.views) || 0, avgDuration: (Number(r.views) || 0) > 0 ? Math.round((Number(r.duration) || 0) / Number(r.views)) : null }))
    const todayStr = new Date().toISOString().slice(0, 10)
    const start14 = new Date(Date.now() - 13 * 86400000); start14.setUTCHours(0, 0, 0, 0)
    const start14Str = start14.toISOString().slice(0, 10)
    const { data: dayRows, error: dayErr } = await supabase.from('pageview_daily').select('day, views').gte('day', start14Str)
    if (dayErr) throw new Error(dayErr.message)
    const traffic = new Array(14).fill(0).map((_, i) => { const d = new Date(start14); d.setUTCDate(d.getUTCDate() + i); return { day: d.toISOString().slice(0, 10), views: 0 } })
    const byDay = new Map(traffic.map(item => [item.day, item]))
    let todayViews = 0
    for (const r of ((dayRows as Array<{ day: string; views: number }>) ?? [])) {
      const bucket = byDay.get(String(r.day).slice(0, 10)); if (bucket) bucket.views += Number(r.views) || 0
      if (String(r.day).slice(0, 10) === todayStr) todayViews += Number(r.views) || 0
    }
    return json({ totals, recentPosts: docs.slice(0, 5).map(({ title, views, link_clicks, created_at }) => ({ title, views: Number(views) || 0, link_clicks: Number(link_clicks) || 0, created_at })), topClicked, traffic, todayViews, topPages, topSearches: [], albumViewsTotal, recentAlbums })
  }
  if (request.method === 'POST' && url.pathname === '/events') {
    if (BOT_RE.test(request.headers.get('User-Agent') ?? '')) return json({ ok: true, skipped: true })
    const { postId, event } = await request.json() as { postId?: string; event?: 'view' | 'link_click' }; if (!postId || !['view', 'link_click'].includes(event ?? '')) return json({ error: 'Invalid event.' }, 400)
    const evIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const nowT = Date.now(); const rec = evRates.get(evIp) ?? { n: 0, t: nowT }; if (nowT - rec.t > 60000) { rec.n = 0; rec.t = nowT }; rec.n++; evRates.set(evIp, rec)
    if (rec.n > 90) return json({ ok: true, limited: true })
    const supabase = getSupabase(env)
    // Simple +1 (non-unique) counters — no visitor dedup, no post_events rows.
    const { error } = await supabase.rpc(event === 'view' ? 'increment_post_view' : 'increment_post_link_click', { p_post_id: postId })
    if (error) return json({ error: `Could not record event: ${error.message.slice(0, 300)}` }, 502)
    return json({ ok: true })
  }
  if (request.method === 'POST' && url.pathname === '/events/batch') {
    if (BOT_RE.test(request.headers.get('User-Agent') ?? '')) return json({ ok: true, skipped: true })
    const body = await request.json() as { views?: unknown; link_clicks?: unknown }
    const views = (Array.isArray(body.views) ? body.views : []).map(String).filter(Boolean).slice(0, 200)
    const clicks = (Array.isArray(body.link_clicks) ? body.link_clicks : []).map(String).filter(Boolean).slice(0, 200)
    if (!views.length && !clicks.length) return json({ error: 'Nothing to count.' }, 400)
    const evIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const nowT = Date.now(); const rec = evRates.get(evIp) ?? { n: 0, t: nowT }; if (nowT - rec.t > 60000) { rec.n = 0; rec.t = nowT }; rec.n++; evRates.set(evIp, rec)
    if (rec.n > 90) return json({ ok: true, limited: true })
    const supabase = getSupabase(env)
    const counts = new Map<string, number>(); const clickCounts = new Map<string, number>()
    for (const id of views) counts.set(id, (counts.get(id) ?? 0) + 1)
    for (const id of clicks) clickCounts.set(id, (clickCounts.get(id) ?? 0) + 1)
    let counted = 0
    for (const [id, n] of counts) {
      // Increment by n via repeated atomic +1 calls (kept simple; batches are small).
      for (let i = 0; i < n; i++) { const { error: e } = await supabase.rpc('increment_post_view', { p_post_id: id }); if (e) return json({ error: `Could not record batch: ${e.message.slice(0, 200)}` }, 502) }
      counted += n
    }
    for (const [id, n] of clickCounts) {
      for (let i = 0; i < n; i++) { const { error: e } = await supabase.rpc('increment_post_link_click', { p_post_id: id }); if (e) return json({ error: `Could not record batch: ${e.message.slice(0, 200)}` }, 502) }
      counted += n
    }
    return json({ ok: true, counted })
  }
  if (url.pathname === '/reactions') {
    if (request.method === 'GET') {
      const postId = url.searchParams.get('postId'); if (!postId) return json({ error: 'Missing postId.' }, 400)
      const supabase = getSupabase(env)
      const { data, error } = await supabase.from('reactions').select('type').eq('post_id', postId)
      if (error) return json({ error: `Could not load reactions: ${error.message}` }, 502)
      let likes = 0, dislikes = 0
      for (const r of (data as Array<{ type: string }>) ?? []) { if (r.type === 'like') likes++; else if (r.type === 'dislike') dislikes++ }
      return json({ likes, dislikes })
    }
    if (request.method === 'POST') {
      const { postId, type } = await request.json() as { postId?: string; type?: 'like' | 'dislike' }; if (!postId || !['like', 'dislike'].includes(type ?? '')) return json({ error: 'Invalid reaction.' }, 400)
      const visitor = await hash(request.headers.get('CF-Connecting-IP') ?? 'unknown', env.IP_HASH_SECRET)
      const supabase = getSupabase(env)
      const { data, error } = await supabase.rpc('toggle_reaction', { p_post_id: postId, p_visitor_hash: visitor, p_type: type })
      if (error) {
        // Fallback: toggle_reaction RPC may not be deployed. Do it manually.
        const { data: existing } = await supabase.from('reactions').select('type').eq('post_id', postId).eq('visitor_hash', visitor).maybeSingle()
        if (existing?.type === type) {
          await supabase.from('reactions').delete().eq('post_id', postId).eq('visitor_hash', visitor)
        } else if (!existing) {
          await supabase.from('reactions').insert({ id: `${postId}:${visitor}`, post_id: postId, visitor_hash: visitor, type })
        } else {
          await supabase.from('reactions').update({ type }).eq('post_id', postId).eq('visitor_hash', visitor)
        }
      }
      // Compute counts from the reactions table (works whether RPC ran or fallback above).
      const { data: rows } = await supabase.from('reactions').select('type').eq('post_id', postId)
      let likes = 0, dislikes = 0
      for (const r of (rows as Array<{ type: string }>) ?? []) { if (r.type === 'like') likes++; else if (r.type === 'dislike') dislikes++ }
      return json({ likes, dislikes }, 200, true)
    }
  }
  return json({ error: 'Not found' }, 404)
  } catch (err) { const message = err instanceof Error ? err.message : String(err); const cors = corsHeaders(request.headers.get('Origin')); return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }) }
} }
