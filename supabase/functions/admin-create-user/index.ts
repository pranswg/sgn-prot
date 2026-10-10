import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import {
  normalizeUsername,
  parseBody,
  requirePermission,
  writeAudit,
} from '../_shared/auth.ts'

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  const guard = await requirePermission(req, 'manage-users')
  if (guard instanceof Response) return guard
  const { profile, admin } = guard

  const body = parseBody(await req.json().catch(() => ({})))
  const firstName = String(body.firstName ?? '').trim()
  const lastName = String(body.lastName ?? '').trim()
  const email = String(body.email ?? '').trim()
  const username = normalizeUsername(String(body.username ?? ''))
  const password = String(body.password ?? '')
  const role = String(body.role ?? '')
  const customPermissions = Array.isArray(body.customPermissions)
    ? (body.customPermissions as string[])
    : null
  const fullName = `${firstName} ${lastName}`.trim()

  if (!firstName || !lastName) {
    return errorResponse('Enter both a first name and a last name.')
  }
  if (!USERNAME_RE.test(username)) {
    return errorResponse('Enter a valid username (3-32 letters, numbers, . _ -).')
  }
  if (password.length < 8) {
    return errorResponse('Password must be at least 8 characters.')
  }
  if (email && !EMAIL_RE.test(email)) {
    return errorResponse('Enter a valid email address or leave it blank.')
  }

  const { data: roleRow } = await admin
    .from('roles')
    .select('id')
    .eq('id', role)
    .maybeSingle()
  if (!roleRow) {
    return errorResponse('Select a role that exists in Roles & Permissions.')
  }

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existing) {
    return errorResponse('That username is already taken.', 409)
  }

  // The Auth email is always the synthetic `<username>@choir.internal` login
  // key. A real address is contact info only and travels on the profile via
  // metadata; using it as the login email would break username sign-in.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${username}@choir.internal`,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      email,
      role_id: role,
      custom_permissions: customPermissions,
      must_change_password: true,
    },
  })
  if (createError || !created.user) {
    return errorResponse(
      createError?.message ?? 'Could not create the account.',
      400,
    )
  }

  await writeAudit(admin, profile, {
    action: 'Created System User',
    module: 'User Management',
    details: `Role: ${role}`,
    affectedUserId: created.user.id,
    affectedUserName: fullName,
  })

  const { data: newProfile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', created.user.id)
    .single()

  return jsonResponse({ profile: newProfile })
})
