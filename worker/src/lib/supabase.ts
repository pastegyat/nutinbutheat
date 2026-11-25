import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type SupabaseEnv = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

let cached: { client: SupabaseClient; url: string; key: string } | null = null

export function getSupabase(env: SupabaseEnv): SupabaseClient {
  if (cached && cached.url === env.SUPABASE_URL && cached.key === env.SUPABASE_SERVICE_ROLE_KEY) return cached.client
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  cached = { client, url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY }
  return client
}
