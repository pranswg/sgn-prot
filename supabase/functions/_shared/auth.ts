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
  custom_permissions: string[] | null
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
 * Validates the caller's JWT and requires an active profile holding
 * `permission`. An Admin always passes. A non-admin passes when the permission
 * is in their explicit `custom_permissions`, or, when that is null, in their
 * role's `role_permissions`. Returns the service-role client plus the caller, or
 * a Response to return as-is.
 */
export async function requirePermission(
  req: Request,
  permission: string,
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
    .select('id, username, full_name, role_id, status, custom_permissions')
    .eq('id', data.user.id)
    .maybeSingle<ActorProfile>()

  if (!profile || profile.status !== 'active') {
    return errorResponse('Your account is not active.', 403)
  }

  const allowed = await actorHasPermission(admin, profile, permission)
  if (!allowed) {
    return errorResponse('You do not have permission to perform this action.', 403)
  }

  return { caller: data.user, profile, admin }
}

async function actorHasPermission(
  admin: SupabaseClient,
  profile: ActorProfile,
  permission: string,
): Promise<boolean> {
  if (profile.role_id === 'admin') return true
  if (profile.custom_permissions !== null) {
    return profile.custom_permissions.includes(permission)
  }
  const { data } = await admin
    .from('role_permissions')
    .select('permission')
    .eq('role_id', profile.role_id)
    .eq('permission', permission)
    .maybeSingle()
  return Boolean(data)
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
