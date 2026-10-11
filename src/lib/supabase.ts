import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * The Supabase browser client, created lazily so importing this module is safe
 * in contexts without a DOM or without env vars (the `node:test` runner imports
 * the auth store, which imports this file). `getSupabase()` throws only when a
 * code path actually needs the client but `.env.local` is missing.
 */
let client: SupabaseClient | null = null

export function supabaseEnv() {
  // `import.meta.env` is injected by Vite. The plain Node test runner has no
  // such object, so guard the access: every Supabase path must read as "not
  // configured" there rather than throwing on `undefined`.
  const env = import.meta.env as unknown as
    | Record<string, string | undefined>
    | undefined
  return {
    url: env?.VITE_SUPABASE_URL,
    anonKey: env?.VITE_SUPABASE_ANON_KEY,
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = supabaseEnv()
  return Boolean(url && anonKey)
}

export function getSupabase(): SupabaseClient {
  if (client) return client
  const { url, anonKey } = supabaseEnv()
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.',
    )
  }
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // No magic-link or OAuth redirect flow exists; login is username+password.
      detectSessionInUrl: false,
    },
  })
  return client
}
