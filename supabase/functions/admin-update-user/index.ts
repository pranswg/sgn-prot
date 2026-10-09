import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { parseBody, requireAdmin, writeAudit } from '../_shared/auth.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STATUSES = ['active', 'disabled', 'suspended', 'pending-activation']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  const guard = await requireAdmin(req)
  if (guard instanceof Response) return guard
  const { profile: actor, admin } = guard

  const body = parseBody(await req.json().catch(() => ({})))
  const id = String(body.id ?? '')
  const patch = parseBody(body.patch ?? body)
  if (!id) return errorResponse('A target account id is required.')

  const { data: target } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!target) {
    return errorResponse('The selected account no longer exists.', 404)
  }

  const has = (key: string) => Object.prototype.hasOwnProperty.call(patch, key)

  const nextRole = has('role') ? String(patch.role ?? '') : target.role_id
  const nextStatus = has('status') ? String(patch.status ?? '') : target.status
  const reason = has('statusReason')
    ? String(patch.statusReason ?? '').trim()
    : target.status_reason

  if (!STATUSES.includes(nextStatus)) {
    return errorResponse('Select a valid account status.')
  }
  if (
    nextStatus !== 'active' &&
    nextStatus !== target.status &&
    !reason
  ) {
    return errorResponse('Provide a reason when disabling or suspending an account.')
  }

  if (nextRole !== target.role_id) {
    const { data: roleRow } = await admin
      .from('roles')
      .select('id')
      .eq('id', nextRole)
      .maybeSingle()
    if (!roleRow) {
      return errorResponse('Select a role that currently exists.')
    }
  }

  const removesAdminAccess =
    target.role_id === 'admin' &&
    target.status === 'active' &&
    (nextRole !== 'admin' || nextStatus !== 'active')
  if (removesAdminAccess) {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', 'admin')
      .eq('status', 'active')
    if ((count ?? 0) <= 1) {
      return errorResponse('At least one active Admin account must remain.')
    }
  }

  const firstName = has('firstName')
    ? String(patch.firstName ?? '').trim()
    : (target.first_name ?? '')
  const lastName = has('lastName')
    ? String(patch.lastName ?? '').trim()
    : (target.last_name ?? '')
  if (
    (has('firstName') || has('lastName')) &&
    (!firstName || !lastName)
  ) {
    return errorResponse('Enter both a first name and a last name.')
  }
  const fullName =
    (has('fullName') ? String(patch.fullName ?? '').trim() : '') ||
    `${firstName} ${lastName}`.trim() ||
    target.full_name

  const email = has('email') ? String(patch.email ?? '').trim() : (target.email ?? '')
  if (email && !EMAIL_RE.test(email)) {
    return errorResponse('Enter a valid email address or leave it blank.')
  }

  let customPermissions = target.custom_permissions as string[] | null
  if (has('customPermissions')) {
    customPermissions = Array.isArray(patch.customPermissions)
      ? (patch.customPermissions as string[])
      : null
  }

  const update = {
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    email,
    role_id: nextRole,
    status: nextStatus,
    status_reason: nextStatus === 'active' ? null : reason ?? null,
    custom_permissions: customPermissions,
  }

  const { data: updated, error } = await admin
    .from('profiles')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()
  if (error || !updated) {
    return errorResponse(error?.message ?? 'Could not update the account.', 400)
  }

  if (nextStatus !== 'active') {
    await admin.rpc('admin_terminate_user_sessions', { p_user_id: id })
  }

  const changes = Object.keys(patch).join(', ')
  await writeAudit(admin, actor, {
    action:
      has('status') && nextStatus !== target.status
        ? nextStatus === 'active'
          ? 'Reactivated User Account'
          : 'Disabled User Account'
        : 'Updated System User',
    module: 'User Management',
    details: `Changed: ${changes}${reason ? `; reason: ${reason}` : ''}`,
    affectedUserId: id,
    affectedUserName: fullName,
  })

  return jsonResponse({ profile: updated })
})
