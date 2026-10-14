import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { PERMISSION_DEFINITIONS } from './rbac.ts'

/**
 * A typo in an RLS `has_permission('...')` literal silently denies the write
 * (RLS fails closed), which is safe but broken and hard to notice. This pins
 * every permission string used by the write/read policies to `rbac.ts`.
 */
const KNOWN = new Set<string>(
  PERMISSION_DEFINITIONS.map((permission) => permission.id),
)

const migrations = [
  '1791641611_0011_rls_write_policies.sql',
  '1791641612_0012_audit_login.sql',
  '1791641613_0013_extra_occasion_batches.sql',
]

function policyPermissions(file: string): string[] {
  const sql = readFileSync(
    new URL(`../../supabase/migrations/${file}`, import.meta.url),
    'utf8',
  )
  return [...sql.matchAll(/has_permission\('([^']+)'\)/g)].map(
    (match) => match[1],
  )
}

for (const file of migrations) {
  test(`${file} uses only known permissions in RLS`, () => {
    const used = policyPermissions(file)
    assert.ok(used.length > 0, 'at least one has_permission() literal is present')
    const unknown = used.filter((permission) => !KNOWN.has(permission))
    assert.deepEqual(unknown, [], `unknown permissions: ${unknown.join(', ')}`)
  })
}
