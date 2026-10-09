import { corsHeaders, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { serviceClient, writeAudit } from '../_shared/auth.ts'

const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_NAME = 'Choir Administrator'

/**
 * Recreates the known backstop Admin whenever no active Admin exists, mirroring
 * the old local seed. Idempotent and safe to call on every app start; it never
 * runs while an active Admin is present, so it is not a backdoor into a real
 * workspace. The seeded account is forced to change its password at first login.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed.', 405)
  }

  const admin = serviceClient()

  const { count: activeAdmins } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', 'admin')
    .eq('status', 'active')
  if ((activeAdmins ?? 0) > 0) {
    return jsonResponse({ seeded: false })
  }

  const { count: nameTaken } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', DEFAULT_ADMIN_USERNAME)
  if ((nameTaken ?? 0) > 0) {
    return jsonResponse({ seeded: false })
  }

  const password = Deno.env.get('DEFAULT_ADMIN_PASSWORD') ?? 'admin1234'
  const { data, error } = await admin.auth.admin.createUser({
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

  if (error || !data.user) {
    return jsonResponse({ seeded: false })
  }

  await writeAudit(
    admin,
    { id: null, full_name: 'System Setup', username: 'system' },
    {
      action: 'Created Default Admin',
      module: 'User Management',
      affectedUserId: data.user.id,
      affectedUserName: DEFAULT_ADMIN_NAME,
    },
  )

  return jsonResponse({ seeded: true, username: DEFAULT_ADMIN_USERNAME })
})
