import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * The single browser-side Supabase client.
 *
 * The URL and anon key come from `.env.local` (see `.env.example`). Both are
 * safe to expose — the anon key relies on Row Level Security for protection.
 * The `service_role` key must never be read here; it belongs only to Edge
 * Functions.
 *
 * The client is created lazily so that importing this module is safe in places
 * with no `import.meta.env` (the `node:test` runner) and so that a missing
 * configuration fails when a network call is attempted, not at module load.
 */
const env = import.meta.env as ImportMetaEnv | undefined
const url = env?.VITE_SUPABASE_URL
const anonKey = env?.VITE_SUPABASE_ANON_KEY

/** Whether `.env.local` supplied both Supabase values. */
export const isSupabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  client ??= createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
