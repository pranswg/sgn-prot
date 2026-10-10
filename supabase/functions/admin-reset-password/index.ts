import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { parseBody, requirePermission, writeAudit } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  const guard = await requirePermission(req, 'manage-users')
  if (guard instanceof Response) return guard
  const { profile: actor, admin } = guard

  const body = parseBody(await req.json().catch(() => ({})))
  const id = String(body.id ?? '')
  const password = String(body.password ?? '')
  const requireChange = body.requireChange !== false
  if (!id) return errorResponse('A target account id is required.')
  if (password.length < 8) {
    return errorResponse('Password must be at least 8 characters.')
  }

  const { data: target } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!target) {
    return errorResponse('The selected account no longer exists.', 404)
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    password,
  })
  if (updateError) {
    return errorResponse(updateError.message, 400)
  }

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ must_change_password: requireChange })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !updated) {
    return errorResponse(error?.message ?? 'Could not update the account.', 400)
  }

  await admin.rpc('admin_terminate_user_sessions', { p_user_id: id })

  await writeAudit(admin, actor, {
    action: 'Reset User Password',
    module: 'User Management',
    details: requireChange
      ? 'Temporary password set; change required at next sign-in.'
      : 'Password set as permanent; no change required at next sign-in.',
    affectedUserId: id,
    affectedUserName: target.full_name,
  })

  return jsonResponse({ profile: updated })
})
