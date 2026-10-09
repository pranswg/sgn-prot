import {
  createClient,
  type SupabaseClient,
  type User,
} from 'jsr:@supabase/supabase-js@2'
import { errorResponse } from './cors.ts'

export interface ActorProfile {
  id: string
  username: string
  full_name: string
  role_id: string
  status: string
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('Supabase environment is not configured.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Validates the caller's JWT and requires an active Admin profile. Returns the
 * service-role client plus the caller, or a Response to return as-is.
 */
export async function requireAdmin(
  req: Request,
): Promise<{ caller: User; profile: ActorProfile; admin: SupabaseClient } | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  )
  if (!token) return errorResponse('Missing authorization token.', 401)

  const admin = serviceClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) {
    return errorResponse('Invalid or expired session.', 401)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, full_name, role_id, status')
    .eq('id', data.user.id)
    .maybeSingle<ActorProfile>()

  if (!profile || profile.role_id !== 'admin' || profile.status !== 'active') {
    return errorResponse('You are not authorized to manage system users.', 403)
  }

  return { caller: data.user, profile, admin }
}

export async function writeAudit(
  admin: SupabaseClient,
  actor: { id: string | null; full_name: string; username: string },
  entry: {
    action: string
    module: string
    details?: string
    affectedUserId?: string
    affectedUserName?: string
  },
): Promise<void> {
  await admin.from('audit_logs').insert({
    actor_id: actor.id,
    actor_name: actor.full_name || 'System Setup',
    actor_username: actor.username || 'system',
    action: entry.action,
    module: entry.module,
    details: entry.details ?? null,
    affected_user_id: entry.affectedUserId ?? null,
    affected_user_name: entry.affectedUserName ?? null,
  })
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}
