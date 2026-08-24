import { useState } from 'react'
import type { FormEvent } from 'react'
import '../AdminPortal.css'
import { ADMIN_TOKEN_KEY } from './auth'

export default function AdminGate({ onLogin, notice = '' }: { onLogin: () => void; notice?: string }) {
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(''); try { const response = await fetch(`${import.meta.env.VITE_APPWRITE_API_URL}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); if (!response.ok) throw new Error('Invalid password.'); const { token } = await response.json() as { token?: string }; if (!token) throw new Error('Invalid password.'); localStorage.setItem(ADMIN_TOKEN_KEY, token); setPassword(''); onLogin() } catch { setError('Sign-in failed.') } finally { setBusy(false) } }
  return <main className="admin"><header><a href="/" className="admin-logo">NUTIN<span>BUT</span>HEAT</a><span>Admin panel</span></header><section><p>Content manager</p><h1>Admin sign in</h1><form onSubmit={submit}><label>Admin password<input type="password" value={password} required autoFocus onChange={e => setPassword(e.target.value)} /></label>{(error || notice) && <output>{error || notice}</output>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></section></main>
}