// Phase 5b: the `admin` Edge Function is the only service-role auth path in the
// app. SQL SECURITY DEFINER RPCs (0010_admin_rpc.sql) cover role CRUD, role
// permissions, account metadata, and status metadata; this function adds the
// three GoTrue-only operations that need the service-role Admin API: create a
// user, reset a password, and ban/unban. Account status changes write the
// profile through the caller-scoped RPC (so the audit check runs as the person
// acting) and then ban/unban through GoTrue so live JWTs die immediately.
//
// Authorization is enforced in two layers: the platform JWT check (verify_jwt,
// config.toml default) plus `has_permission('manage-users')` resolved for the
// calling user. The service_role key is never exposed to the caller.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AccountStatus = 'active' | 'disabled' | 'suspended' | 'pending-activation'

interface CreateUserInput {
  username: string
  firstName: string
  lastName: string
  email?: string
  role: string
  customPermissions: string[] | null
  password: string
}

interface ResetPasswordInput {
  userId: string
  password: string
  mustChangePassword: boolean
}

interface SetAccountStatusInput {
  userId: string
  status: AccountStatus
  statusReason?: string | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function problem(message: string, code = 'bad-request'): Response {
  return json({ error: { code, message } })
}

async function createUser(
  caller: SupabaseClient,
  admin: SupabaseClient,
  input: CreateUserInput,
): Promise<Response> {
  const username = String(input.username ?? '').trim()
  const password = String(input.password ?? '')
  if (!username || !password) {
    return problem('Username and password are required.')
  }

  const firstName = String(input.firstName ?? '').trim()
  const lastName = String(input.lastName ?? '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || username
  const email = String(input.email ?? '').trim() || `${username}@choir.local`

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !created.user) {
    return problem(error?.message ?? 'Could not create the account.', 'create-failed')
  }
  const userId = created.user.id

  const { error: metaError } = await caller.rpc('admin_update_account_metadata', {
    p_user_id: userId,
    p_full_name: fullName,
    p_email: email,
    p_role: String(input.role ?? 'admin'),
    p_custom_permissions: Array.isArray(input.customPermissions)
      ? input.customPermissions
      : null,
  })
  if (metaError) {
    await admin.auth.admin.deleteUser(userId)
    return problem(
      'The account was created but could not be configured. Nothing was saved; please try again.',
      'configure-failed',
    )
  }

  await admin
    .from('profiles')
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq('id', userId)

  return json({ data: { accountId: userId } })
}

async function resetPassword(
  admin: SupabaseClient,
  input: ResetPasswordInput,
): Promise<Response> {
  const userId = String(input.userId ?? '')
  const password = String(input.password ?? '')
  if (!userId || !password) {
    return problem('User and password are required.')
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) {
    return problem(error.message, 'reset-failed')
  }

  await admin
    .from('profiles')
    .update({
      must_change_password: input.mustChangePassword !== false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  return json({ data: { userId } })
}

async function setAccountStatus(
  caller: SupabaseClient,
  admin: SupabaseClient,
  input: SetAccountStatusInput,
): Promise<Response> {
  const userId = String(input.userId ?? '')
  const status = input.status
  if (!userId || !status) {
    return problem('User and status are required.')
  }

  const { error } = await caller.rpc('admin_set_account_status', {
    p_user_id: userId,
    p_status: status,
    p_status_reason: input.statusReason ?? null,
  })
  if (error) {
    return problem(error.message, 'status-failed')
  }

  const banDuration = status === 'active' ? 'none' : '876000h'
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  })
  if (banError) {
    return problem(banError.message, 'ban-failed')
  }

  return json({ data: { userId } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return problem('Method not allowed.', 'method')
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return problem('Missing authorization token.', 'unauthorized')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return problem('The function is not configured.', 'server-error')
  }

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await caller.auth.getUser(token)
  if (userError || !userData.user) {
    return problem('Unauthorized.', 'unauthorized')
  }

  const { data: allowed, error: permError } = await caller.rpc('has_permission', {
    perm: 'manage-users',
  })
  if (permError) {
    return problem('The server rejected the request.', 'server-error')
  }
  if (allowed !== true) {
    return problem('You do not have permission to manage users.', 'forbidden')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: { action?: string; input?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return problem('Invalid JSON body.', 'bad-request')
  }

  switch (body.action) {
    case 'createUser':
      return await createUser(caller, admin, (body.input ?? {}) as CreateUserInput)
    case 'resetPassword':
      return await resetPassword(admin, (body.input ?? {}) as ResetPasswordInput)
    case 'setAccountStatus':
      return await setAccountStatus(
        caller,
        admin,
        (body.input ?? {}) as SetAccountStatusInput,
      )
    default:
      return problem(`Unknown action: ${String(body.action)}.`, 'bad-request')
  }
})