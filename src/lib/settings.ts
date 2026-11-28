import { useSyncExternalStore } from 'react'
import { apiUrl } from './appwrite'

// Global site settings, sourced from the Worker (R2) so the Christmas toggle is
// the same for every visitor. Defaults to on until the fetch reports otherwise.
let enabled = true
let loaded = false
const listeners = new Set<() => void>()

function emit() { for (const listener of listeners) listener() }

function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }

export function getChristmasEnabled() { return enabled }

export async function loadChristmasSetting(): Promise<void> {
  if (loaded || !apiUrl) return
  loaded = true
  try {
    const response = await fetch(`${apiUrl}/settings/christmas`, { cache: 'no-store' })
    if (!response.ok) return
    const data = await response.json() as { enabled?: boolean }
    if (typeof data.enabled === 'boolean' && data.enabled !== enabled) { enabled = data.enabled; emit() }
  } catch { /* keep default */ }
}

export async function saveChristmasSetting(next: boolean): Promise<boolean> {
  if (!apiUrl) return false
  try {
    const response = await fetch(`${apiUrl}/admin/settings/christmas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': localStorage.getItem('nbh_admin_token') ?? '' },
      body: JSON.stringify({ enabled: next }),
    })
    if (!response.ok) return false
    if (next !== enabled) { enabled = next; emit() }
    return true
  } catch { return false }
}

export function useChristmasEnabled(): boolean {
  return useSyncExternalStore(subscribe, getChristmasEnabled, getChristmasEnabled)
}
