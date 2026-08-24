import * as fs from 'node:fs'
import * as path from 'node:path'
import XLSX from 'xlsx'

const EXCEL = 'C:\\Users\\renaldo\\Desktop\\posts_table_complete.xlsx'
const UPLOADS_DIR = 'C:\\Users\\renaldo\\Desktop\\uploads'
const API = process.env.VITE_APPWRITE_API_URL || 'https://nutinbutheat-api.nutin.workers.dev'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
if (!ADMIN_PASSWORD) { console.error('Set ADMIN_PASSWORD env var'); process.exit(1) }

async function getToken(): Promise<string> {
  const r = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: ADMIN_PASSWORD }) })
  if (!r.ok) throw new Error(`login ${r.status} ${await r.text()}`)
  const j = await r.json() as { token: string }
  return j.token
}

function excelSerialToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  return new Date(ms).toISOString()
}

function normalizeCategory(raw: string): string {
  const v = (raw || '').trim()
  if (!v) return 'Ebony'
  const low = v.toLowerCase()
  if (low === 'pawg' || low === 'pawg') return 'Pawg'
  if (low === 'onlyfans' || low === 'onlyfans.com') return 'Onlyfans'
  if (low === 'ebony' || low === 'eb6' || low === 'ebon6') return 'Ebony'
  if (low === 'asian') return 'Asian'
  if (low === 'latina') return 'Latina'
  if (low === 'mixed') return 'Mixed'
  // TitleCase fallback
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
}

async function presignUpload(token: string, filename: string, folder: string): Promise<{ uploadUrl: string; publicUrl: string }> {
  const r = await fetch(`${API}/admin/albums/presign`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify({ filename, folder }) })
  if (!r.ok) throw new Error(`presign ${r.status} ${await r.text()}`)
  return r.json() as Promise<{ uploadUrl: string; publicUrl: string }>
}

async function putFile(uploadUrl: string, filePath: string, contentType: string) {
  const buf = fs.readFileSync(filePath)
  const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: buf })
  if (!r.ok) throw new Error(`PUT ${r.status} ${await r.text()}`)
}

async function main() {
  const token = await getToken()
  console.log('token ok', token.slice(0, 20))

  const wb = XLSX.readFile(EXCEL)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  console.log(`rows ${rows.length}`)

  type Raw = { id: unknown; title: unknown; slug: unknown; description: unknown; image_url: unknown; category: unknown; created_at: unknown; is_premium: unknown; status: unknown; views: unknown; link_clicks: unknown }

  const posts: Array<Record<string, unknown>> = []
  const uploadTasks: Array<{ filename: string; filePath: string; rowIdx: number }> = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as Raw
    const title = String(r.title ?? '').trim()
    const slug = String(r.slug ?? '').trim().toLowerCase()
    const description = String(r.description ?? '').trim()
    const imageRel = String(r.image_url ?? '').trim() // uploads/xxx.jpg
    const filename = path.basename(imageRel)
    const filePath = path.join(UPLOADS_DIR, filename)
    if (!title || !slug || !filename) { console.warn(`skip row ${i + 2} missing title/slug/filename`); continue }
    if (!fs.existsSync(filePath)) { console.warn(`missing file ${filename} row ${i + 2}`); continue }
    const category = normalizeCategory(String(r.category ?? ''))
    const serial = Number(r.created_at)
    const created_at = Number.isFinite(serial) && serial > 30000 ? excelSerialToISO(serial) : new Date().toISOString()
    const is_premium = String(r.is_premium ?? '').toLowerCase() === 'yes' ? 'yes' : 'no'
    const status = String(r.status ?? '').toLowerCase() === 'private' ? 'private' : 'public'
    const views = Number(r.views ?? 0) || 0
    const link_clicks = Number(r.link_clicks ?? 0) || 0

    posts.push({ title, slug, description, category, is_premium, status, views, link_clicks, created_at, _filename: filename, _filePath: filePath })
    uploadTasks.push({ filename, filePath, rowIdx: posts.length - 1 })
  }

  console.log(`prepared ${posts.length} posts, uploading ${uploadTasks.length} images to posts/ ...`)

  // Upload images 5 concurrent
  const CONC = 5
  let done = 0
  const results: string[] = new Array(posts.length)

  async function worker() {
    while (true) {
      const task = uploadTasks.shift()
      if (!task) break
      const ext = path.extname(task.filename).toLowerCase() || '.jpg'
      const ct = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
      // posts folder keeps original filename
      const { uploadUrl, publicUrl } = await presignUpload(token, task.filename, 'posts')
      await putFile(uploadUrl, task.filePath, ct)
      results[task.rowIdx] = publicUrl
      done++
      if (done % 50 === 0) console.log(`uploaded ${done}/${posts.length}`)
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()))
  console.log(`all uploads done ${done}`)

  // Assign image_url
  for (let i = 0; i < posts.length; i++) {
    posts[i].image_url = results[i]
    delete (posts[i] as Record<string, unknown>)._filename
    delete (posts[i] as Record<string, unknown>)._filePath
  }

  // Wipe then import in batches of 50
  console.log('wiping existing posts...')
  const wipeRes = await fetch(`${API}/admin/import-posts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify({ wipe: true, posts: [] }) })
  console.log('wipe', wipeRes.status, await wipeRes.text().then(t => t.slice(0, 300)))

  const BATCH = 50
  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH)
    console.log(`importing batch ${i / BATCH + 1}/${Math.ceil(posts.length / BATCH)} (${batch.length})`)
    const r = await fetch(`${API}/admin/import-posts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token }, body: JSON.stringify({ posts: batch }) })
    const txt = await r.text()
    console.log(`batch ${i / BATCH + 1} ${r.status} ${txt.slice(0, 500)}`)
    if (!r.ok) throw new Error(`batch failed ${r.status} ${txt}`)
    await new Promise(res => setTimeout(res, 300))
  }

  console.log('done')
}

main().catch(e => { console.error(e); process.exit(1) })
