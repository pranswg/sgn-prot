import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { ADMIN_ONLY_PERMISSIONS, PERMISSION_DEFINITIONS } from './rbac.ts'

const sql = readFileSync(
  new URL('../../supabase/migrations/1791641610_0010_admin_rpc.sql', import.meta.url),
  'utf8',
)

function extract(begin: string, end: string): string[] {
  const start = sql.indexOf(begin)
  const stop = sql.indexOf(end)
  assert.ok(start >= 0 && stop > start, `markers ${begin}/${end} are present`)
  return [...sql.slice(start + begin.length, stop).matchAll(/'([^']+)'/g)].map(
    (match) => match[1],
  )
}

test('SQL all_permissions() matches rbac.ts', () => {
  assert.deepEqual(
    extract('-- @permissions-begin', '-- @permissions-end'),
    PERMISSION_DEFINITIONS.map((permission) => permission.id),
  )
})

test('SQL admin_only_permissions() matches rbac.ts', () => {
  assert.deepEqual(
    extract('-- @admin-only-begin', '-- @admin-only-end'),
    ADMIN_ONLY_PERMISSIONS,
  )
})
