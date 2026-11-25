/*
 * One-way, idempotent copy for the parallel migration. Run only after applying
 * supabase/migrations/202608240001_initial_schema.sql to the target project.
 * Required env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID,
 * APPWRITE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
type Doc = Record<string, unknown>

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value }
const appwriteEndpoint = required('APPWRITE_ENDPOINT').replace(/\/$/, '')
const appwriteProject = required('APPWRITE_PROJECT_ID')
const appwriteDatabase = required('APPWRITE_DATABASE_ID')
const appwriteKey = required('APPWRITE_API_KEY')
const supabaseUrl = required('SUPABASE_URL').replace(/\/$/, '')
const supabaseKey = required('SUPABASE_SERVICE_ROLE_KEY')

const collections = [
  ['APPWRITE_POSTS_COLLECTION_ID', 'posts'],
  ['APPWRITE_ALBUMS_COLLECTION_ID', 'albums'],
  ['APPWRITE_ALBUM_ITEMS_COLLECTION_ID', 'album_items'],
  ['APPWRITE_REACTIONS_COLLECTION_ID', 'reactions'],
  ['APPWRITE_POST_EVENTS_COLLECTION_ID', 'post_events'],
  ['APPWRITE_ANALYTICS_COLLECTION_ID', 'analytics'],
  ['APPWRITE_CONTACT_COLLECTION_ID', 'contact_messages'],
] as const

const timestamp = (doc: Doc) => String(doc.created_at ?? doc.$createdAt ?? new Date().toISOString())
const text = (doc: Doc, key: string, fallback = '') => String(doc[key] ?? fallback)
function mapRow(table: string, doc: Doc): Doc {
  const id = text(doc, '$id')
  if (!id) throw new Error(`Document without $id in ${table}`)
  const base = { id, created_at: timestamp(doc) }
  if (table === 'posts') return { ...base, title: text(doc, 'title'), slug: text(doc, 'slug'), description: text(doc, 'description'), image_url: text(doc, 'image_url'), category: text(doc, 'category'), is_premium: text(doc, 'is_premium', 'no'), status: text(doc, 'status', 'public'), views: Number(doc.views ?? 0), link_clicks: Number(doc.link_clicks ?? 0) }
  if (table === 'albums') return { ...base, title: text(doc, 'title'), slug: text(doc, 'slug'), description: text(doc, 'description'), thumbnail: text(doc, 'thumbnail'), is_premium: text(doc, 'is_premium', 'no'), view_count: Number(doc.view_count ?? 0) }
  if (table === 'album_items') return { ...base, album_id: text(doc, 'album_id'), type: text(doc, 'type', 'video'), title: text(doc, 'title'), r2_url: text(doc, 'r2_url'), thumbnail: text(doc, 'thumbnail'), sort_order: Number(doc.sort_order ?? 0) }
  if (table === 'reactions') return { ...base, post_id: text(doc, 'post_id'), visitor_hash: text(doc, 'visitor_hash'), type: text(doc, 'type') }
  if (table === 'post_events') return { ...base, post_id: text(doc, 'post_id'), visitor_hash: text(doc, 'visitor_hash'), event_type: text(doc, 'event_type') }
  if (table === 'analytics') return { ...base, path: text(doc, 'path'), search_term: text(doc, 'search_term'), duration_ms: typeof doc.duration_ms === 'number' ? doc.duration_ms : null }
  return { ...base, name: text(doc, 'name'), email: text(doc, 'email'), reason: text(doc, 'reason'), message: text(doc, 'message'), ip_address: text(doc, 'ip_address') }
}

async function listDocuments(collectionId: string) {
  const result: Doc[] = []; let offset = 0
  while (true) {
    const query = new URLSearchParams({ 'queries[]': JSON.stringify({ method: 'limit', values: [1000] }) })
    if (offset) query.append('queries[]', JSON.stringify({ method: 'offset', values: [offset] }))
    const response = await fetch(`${appwriteEndpoint}/databases/${appwriteDatabase}/collections/${collectionId}/documents?${query}`, { headers: { 'X-Appwrite-Project': appwriteProject, 'X-Appwrite-Key': appwriteKey } })
    if (!response.ok) throw new Error(`Appwrite read failed: ${collectionId} (${response.status})`)
    const page = await response.json() as { documents: Doc[] }
    result.push(...page.documents)
    if (page.documents.length < 1000) return result
    offset += 1000
  }
}

async function upsert(table: string, rows: Doc[]) {
  for (let start = 0; start < rows.length; start += 500) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=id`, { method: 'POST', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(start, start + 500)) })
    if (!response.ok) throw new Error(`Supabase upsert failed: ${table} (${response.status}) ${await response.text()}`)
  }
}

for (const [collectionEnv, table] of collections) {
  const documents = await listDocuments(required(collectionEnv))
  await upsert(table, documents.map(doc => mapRow(table, doc)))
  console.log(`${table}: ${documents.length} migrated`)
}
