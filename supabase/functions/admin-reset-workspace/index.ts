import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { requirePermission, writeAudit } from '../_shared/auth.ts'

const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_NAME = 'Choir Administrator'

/**
 * Factory reset. An active Admin may wipe the whole workspace and every account,
 * returning the app to a known first-run state: no choir data, no security
 * trail, and only the default `admin` account (forced to change its password).
 *
 * The data half runs in SQL (`reset_workspace()`), which also marks the
 * workspace initialised so a device still holding cached rows cannot seed them
 * back. The account half lives here because deleting users needs the service
 * role. The caller's own account is deleted too, so its session ends with this
 * request — the client signs out and the user logs back in as the default admin.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  const guard = await requirePermission(req, 'restore-data')
  if (guard instanceof Response) return guard
  const { profile, admin } = guard

  const { error: resetError } = await admin.rpc('reset_workspace')
  if (resetError) return errorResponse(resetError.message, 400)

  const ids: string[] = []
  const perPage = 200
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return errorResponse(error.message, 400)
    const users = data?.users ?? []
    ids.push(...users.map((user) => user.id))
    if (users.length < perPage) break
    page += 1
  }

  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return errorResponse(error.message, 400)
  }

  const password = Deno.env.get('DEFAULT_ADMIN_PASSWORD') ?? 'admin1234'
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${DEFAULT_ADMIN_USERNAME}@choir.internal`,
    password,
    email_confirm: true,
    user_metadata: {
      username: DEFAULT_ADMIN_USERNAME,
      full_name: DEFAULT_ADMIN_NAME,
      first_name: 'Choir',
      last_name: 'Administrator',
      role_id: 'admin',
      must_change_password: true,
    },
  })
  if (createError || !created.user) {
    return errorResponse(createError?.message ?? 'Could not recreate the default admin.', 400)
  }

  await writeAudit(admin, profile, {
    action: 'Reset Workspace',
    module: 'System',
    details: `Deleted ${ids.length} account(s) and all workspace data.`,
    affectedUserId: created.user.id,
    affectedUserName: DEFAULT_ADMIN_NAME,
  })

  return jsonResponse({ reset: true, username: DEFAULT_ADMIN_USERNAME })
})
