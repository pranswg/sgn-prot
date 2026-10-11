import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

/**
 * Domain write path (Phase 4). The only place that pushes store records to
 * Supabase. Every function resolves to `{ error }` instead of throwing, so a
 * caller can roll its optimistic local change back on failure. When no Supabase
 * env is configured the writes are skipped and report success, so the app and
 * the node test runner stay localStorage-only exactly as before Phase 4.
 */
export interface WriteResult {
  error: string | null
}

type QueryResult = { error: { message: string } | null }

async function run(build: () => PromiseLike<QueryResult>): Promise<WriteResult> {
  if (!isSupabaseConfigured()) return { error: null }
  try {
    const { error } = await build()
    return { error: error ? error.message : null }
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) }
  }
}

/** Upserts one whole JSONB document row (the Phase 1 table shape). */
export function upsertRow(
  table: string,
  id: string,
  data: unknown,
): Promise<WriteResult> {
  return run(() =>
    getSupabase()
      .from(table)
      .upsert({ id, data, updated_at: new Date().toISOString() }),
  )
}

/** Deletes one row by id. */
export function deleteRow(table: string, id: string): Promise<WriteResult> {
  return run(() => getSupabase().from(table).delete().eq('id', id))
}

/** Upserts one owner-scoped row (used by per-user tables like presets). */
export function upsertOwnedRow(
  table: string,
  id: string,
  data: unknown,
  ownerId: string,
): Promise<WriteResult> {
  return run(() =>
    getSupabase()
      .from(table)
      .upsert({ id, data, owner_id: ownerId, updated_at: new Date().toISOString() }),
  )
}

/** Upserts the single shared settings row (`id = 1`). */
export function upsertSettingsRow(data: unknown): Promise<WriteResult> {
  return run(() =>
    getSupabase()
      .from('settings')
      .upsert({ id: 1, data, updated_at: new Date().toISOString() }),
  )
}
