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
  const { caller, profile: actor, admin } = guard

  const body = parseBody(await req.json().catch(() => ({})))
  const id = String(body.id ?? '')
  if (!id) return errorResponse('A target account id is required.')
  if (id === caller.id) {
    return errorResponse('You cannot delete the account you are signed in with.')
  }

  const { data: target } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!target) {
    return errorResponse('The selected account no longer exists.', 404)
  }

  if (target.role_id === 'admin' && target.status === 'active') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', 'admin')
      .eq('status', 'active')
    if ((count ?? 0) <= 1) {
      return errorResponse('At least one active Admin account must remain.')
    }
  }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return errorResponse(error.message, 400)

  await writeAudit(admin, actor, {
    action: 'Deleted System User',
    module: 'User Management',
    affectedUserId: id,
    affectedUserName: target.full_name,
  })

  return jsonResponse({ deleted: id })
})
